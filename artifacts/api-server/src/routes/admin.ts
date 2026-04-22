import { Router, type IRouter } from "express";
import { db, featuresTable, prdsTable, tasksTable, sprintsTable } from "@workspace/db";
import { count, avg, sql } from "drizzle-orm";
import { GetAdminStatsResponse, GetRecentActivityResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [featureCount] = await db.select({ count: count() }).from(featuresTable);
  const [prdCount] = await db.select({ count: count() }).from(prdsTable);
  const [taskCount] = await db.select({ count: count() }).from(tasksTable);
  const [sprintCount] = await db.select({ count: count() }).from(sprintsTable);

  const [avgStats] = await db.select({
    avgTasks: avg(prdsTable.totalTasks),
    avgSprints: avg(prdsTable.totalSprints),
    avgEffort: avg(prdsTable.totalEffortPoints),
  }).from(prdsTable);

  const taskRows = await db
    .select({ priority: tasksTable.priority, type: tasksTable.type })
    .from(tasksTable);

  const tasksByPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  const tasksByType = { user_story: 0, engineering: 0, bug: 0, infrastructure: 0, design: 0 };

  for (const task of taskRows) {
    if (task.priority in tasksByPriority) {
      tasksByPriority[task.priority as keyof typeof tasksByPriority]++;
    }
    if (task.type in tasksByType) {
      tasksByType[task.type as keyof typeof tasksByType]++;
    }
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentFeatures = await db
    .select({ count: count() })
    .from(featuresTable)
    .where(sql`${featuresTable.createdAt} >= ${oneWeekAgo}`);

  const stats = {
    totalFeatures: featureCount?.count ?? 0,
    totalPrds: prdCount?.count ?? 0,
    totalTasks: taskCount?.count ?? 0,
    totalSprints: sprintCount?.count ?? 0,
    avgTasksPerPrd: parseFloat(String(avgStats?.avgTasks ?? 0)) || 0,
    avgSprintsPerPrd: parseFloat(String(avgStats?.avgSprints ?? 0)) || 0,
    avgEffortPerPrd: parseFloat(String(avgStats?.avgEffort ?? 0)) || 0,
    tasksByPriority,
    tasksByType,
    recentGenerations: recentFeatures[0]?.count ?? 0,
  };

  res.json(GetAdminStatsResponse.parse(stats));
});

router.get("/admin/recent-activity", async (_req, res): Promise<void> => {
  const features = await db
    .select({
      id: featuresTable.id,
      featureTitle: featuresTable.title,
      status: featuresTable.status,
      createdAt: featuresTable.createdAt,
      prdId: prdsTable.id,
      taskCount: prdsTable.totalTasks,
      sprintCount: prdsTable.totalSprints,
    })
    .from(featuresTable)
    .leftJoin(prdsTable, sql`${prdsTable.featureId} = ${featuresTable.id}`)
    .orderBy(sql`${featuresTable.createdAt} desc`)
    .limit(20);

  const activity = features.map((f) => ({
    id: f.id,
    featureTitle: f.featureTitle,
    status: f.status,
    createdAt: f.createdAt,
    prdId: f.prdId ?? null,
    taskCount: f.taskCount ?? null,
    sprintCount: f.sprintCount ?? null,
  }));

  res.json(GetRecentActivityResponse.parse(activity));
});

export default router;
