import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, featuresTable, prdsTable, tasksTable, sprintsTable } from "@workspace/db";
import { GeneratePrdBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface RawTask {
  title: string;
  description: string;
  type: "user_story" | "engineering" | "bug" | "infrastructure" | "design";
  priority: "critical" | "high" | "medium" | "low";
  effortPoints: number;
  riskLevel: "high" | "medium" | "low";
  dependencyTitles?: string[];
  dependencies?: number[];
}

interface RawSprint {
  sprintNumber: number;
  name: string;
  goal: string;
  taskTitles: string[];
}

interface GeneratedPlan {
  overview: string;
  goals: string;
  userStories: string;
  technicalRequirements: string;
  successMetrics: string;
  tasks: RawTask[];
  sprints: RawSprint[];
}

function computePriorityScore(task: RawTask): number {
  const priorityWeights = { critical: 40, high: 30, medium: 20, low: 10 };
  const effortPenalty = Math.min(task.effortPoints * 2, 20);
  const riskBonus = task.riskLevel === "high" ? 10 : task.riskLevel === "medium" ? 5 : 0;
  return priorityWeights[task.priority] + riskBonus - effortPenalty;
}

function computeRiskScore(tasks: RawTask[]): number {
  const highRisk = tasks.filter((t) => t.riskLevel === "high").length;
  const totalEffort = tasks.reduce((acc, t) => acc + t.effortPoints, 0);
  const riskRatio = tasks.length > 0 ? highRisk / tasks.length : 0;
  const effortFactor = Math.min(totalEffort / 100, 1);
  return parseFloat((riskRatio * 0.6 + effortFactor * 0.4).toFixed(2));
}

router.post("/ai/generate-prd", async (req, res): Promise<void> => {
  const parsed = GeneratePrdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { featureId } = parsed.data;

  const [feature] = await db
    .select()
    .from(featuresTable)
    .where(eq(featuresTable.id, featureId));

  if (!feature) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }

  // Pre-screen: confirm the input describes a software / technology product feature
  try {
    const screenCompletion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 100,
      messages: [
        {
          role: "user",
          content: `You are a gatekeeper for a sprint planning tool used exclusively by technology teams building software products and systems.

Determine whether the following input describes a legitimate software feature, technical capability, or product improvement that a technology team could build and plan sprints for.

Title: ${feature.title}
Description: ${feature.description}

Respond with JSON only:
{"valid": true} — if this is a genuine software/tech product feature
{"valid": false, "reason": "one-sentence plain-English explanation"} — if this is NOT a software feature (e.g. general knowledge questions, trivia, non-technical requests, factual lookups)`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const screenContent = screenCompletion.choices[0]?.message?.content ?? '{"valid":true}';
    const screen = JSON.parse(screenContent) as { valid: boolean; reason?: string };

    if (!screen.valid) {
      const reason = screen.reason ?? "This doesn't appear to be a software product feature.";
      res.status(422).json({
        error: reason,
        code: "INVALID_FEATURE_TOPIC",
        hint: "Sprint Planner is designed for technology teams building software products. Please describe a feature, capability, or system improvement your team wants to build.",
      });
      return;
    }
  } catch (screenErr) {
    logger.warn({ screenErr }, "Feature screening call failed — proceeding with generation");
  }

  await db
    .update(featuresTable)
    .set({ status: "generating" })
    .where(eq(featuresTable.id, featureId));

  try {
    const prompt = `You are a senior product manager and engineering lead. Given this feature idea, produce a comprehensive PRD and sprint plan as JSON.

Feature Title: ${feature.title}
Feature Description: ${feature.description}

Produce a JSON response with exactly this structure:
{
  "overview": "2-3 paragraph product overview describing the feature, its value proposition, and user impact",
  "goals": "bullet-point list of 4-6 clear product goals (use \\n to separate bullets, prefix each with - )",
  "userStories": "5-8 user stories in 'As a [role], I want [action] so that [benefit]' format, each on a new line",
  "technicalRequirements": "technical requirements as bullet points covering architecture, APIs, data models, security, performance",
  "successMetrics": "4-6 measurable success metrics with specific targets (e.g., '- Reduce task creation time by 40%')",
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed task description",
      "type": "user_story|engineering|bug|infrastructure|design",
      "priority": "critical|high|medium|low",
      "effortPoints": 1-13,
      "riskLevel": "high|medium|low",
      "dependencyTitles": ["title of task this depends on"]
    }
  ],
  "sprints": [
    {
      "sprintNumber": 1,
      "name": "Sprint 1: Foundation",
      "goal": "Sprint goal in one sentence",
      "taskTitles": ["exact task titles assigned to this sprint"]
    }
  ]
}

Rules for tasks:
- Create 8-15 tasks covering all aspects: user stories, engineering work, infrastructure setup, design
- Mix types: 2-3 user_story, 5-8 engineering, 1-2 infrastructure, 1-2 design
- Effort points follow Fibonacci: 1, 2, 3, 5, 8, 13
- Detect real dependencies (e.g., API must exist before UI can call it)
- Priority: critical = blockers, high = core features, medium = enhancements, low = nice-to-have
- Risk: high = new technology/unknown complexity, medium = moderate complexity, low = well-understood

Rules for sprints:
- 2-4 sprints total
- Each sprint max 25 effort points
- Sprint 1: foundation/infrastructure
- Last sprint: testing, polish, launch prep
- All tasks must be in a sprint

Respond with ONLY the JSON, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No content from AI");

    const plan: GeneratedPlan = JSON.parse(content);

    const [prd] = await db
      .insert(prdsTable)
      .values({
        featureId,
        featureTitle: feature.title,
        overview: plan.overview,
        goals: plan.goals,
        userStories: plan.userStories,
        technicalRequirements: plan.technicalRequirements,
        successMetrics: plan.successMetrics,
        totalTasks: plan.tasks.length,
        totalSprints: plan.sprints.length,
        totalEffortPoints: plan.tasks.reduce((acc, t) => acc + t.effortPoints, 0),
        riskScore: computeRiskScore(plan.tasks),
      })
      .returning();

    const titleToIdMap = new Map<string, number>();

    const insertedTasks = [];
    for (const task of plan.tasks) {
      const [inserted] = await db
        .insert(tasksTable)
        .values({
          prdId: prd.id,
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          effortPoints: task.effortPoints,
          priorityScore: computePriorityScore(task),
          riskLevel: task.riskLevel,
          dependencies: "[]",
          status: "backlog",
        })
        .returning();
      titleToIdMap.set(task.title, inserted.id);
      insertedTasks.push({ ...task, dbId: inserted.id });
    }

    for (const task of insertedTasks) {
      const deps = (task.dependencyTitles || [])
        .map((title) => titleToIdMap.get(title))
        .filter((id): id is number => id !== undefined);

      if (deps.length > 0) {
        await db
          .update(tasksTable)
          .set({ dependencies: JSON.stringify(deps) })
          .where(eq(tasksTable.id, task.dbId));
      }
    }

    const insertedSprints = [];
    for (const sprint of plan.sprints) {
      const sprintTaskIds = sprint.taskTitles
        .map((title) => titleToIdMap.get(title))
        .filter((id): id is number => id !== undefined);

      const sprintTasks = insertedTasks.filter((t) =>
        sprintTaskIds.includes(t.dbId)
      );
      const totalEffortPoints = sprintTasks.reduce(
        (acc, t) => acc + t.effortPoints,
        0
      );

      const [insertedSprint] = await db
        .insert(sprintsTable)
        .values({
          prdId: prd.id,
          sprintNumber: sprint.sprintNumber,
          name: sprint.name,
          goal: sprint.goal,
          totalEffortPoints,
          taskCount: sprintTaskIds.length,
        })
        .returning();

      for (const taskId of sprintTaskIds) {
        await db
          .update(tasksTable)
          .set({ sprintId: insertedSprint.id, status: "in_sprint" })
          .where(eq(tasksTable.id, taskId));
      }

      insertedSprints.push(insertedSprint);
    }

    await db
      .update(featuresTable)
      .set({ status: "completed" })
      .where(eq(featuresTable.id, featureId));

    const finalTasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.prdId, prd.id));

    const finalSprints = await db
      .select()
      .from(sprintsTable)
      .where(eq(sprintsTable.prdId, prd.id))
      .orderBy(sprintsTable.sprintNumber);

    res.status(201).json({
      prd,
      tasks: finalTasks.map((t) => ({
        ...t,
        dependencies: JSON.parse(t.dependencies || "[]") as number[],
        sprintId: t.sprintId ?? null,
      })),
      sprints: finalSprints.map((s) => ({
        ...s,
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "AI generation failed");
    await db
      .update(featuresTable)
      .set({ status: "failed" })
      .where(eq(featuresTable.id, featureId));
    res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
