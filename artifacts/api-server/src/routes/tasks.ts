import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  ListTasksQueryParams,
  GetTaskResponse,
  ListTasksResponse,
  UpdateTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const queryParams = ListTasksQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { prdId, sprintId } = queryParams.data;

  const conditions = [];
  if (prdId != null) conditions.push(eq(tasksTable.prdId, prdId));
  if (sprintId != null) conditions.push(eq(tasksTable.sprintId, sprintId));

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tasksTable.createdAt);

  const parsed = tasks.map((t) => ({
    ...t,
    dependencies: JSON.parse(t.dependencies || "[]") as number[],
    sprintId: t.sprintId ?? null,
  }));

  res.json(ListTasksResponse.parse(parsed));
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(GetTaskResponse.parse({
    ...task,
    dependencies: JSON.parse(task.dependencies || "[]") as number[],
    sprintId: task.sprintId ?? null,
  }));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set(body.data)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(UpdateTaskResponse.parse({
    ...task,
    dependencies: JSON.parse(task.dependencies || "[]") as number[],
    sprintId: task.sprintId ?? null,
  }));
});

export default router;
