import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sprintsTable } from "@workspace/db";
import {
  GetSprintParams,
  ListSprintsQueryParams,
  GetSprintResponse,
  ListSprintsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sprints", async (req, res): Promise<void> => {
  const queryParams = ListSprintsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const { prdId } = queryParams.data;

  const sprints = await db
    .select()
    .from(sprintsTable)
    .where(prdId != null ? eq(sprintsTable.prdId, prdId) : undefined)
    .orderBy(sprintsTable.sprintNumber);

  const parsed = sprints.map((s) => ({
    ...s,
    startDate: s.startDate ?? null,
    endDate: s.endDate ?? null,
  }));

  res.json(ListSprintsResponse.parse(parsed));
});

router.get("/sprints/:id", async (req, res): Promise<void> => {
  const params = GetSprintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [sprint] = await db
    .select()
    .from(sprintsTable)
    .where(eq(sprintsTable.id, params.data.id));

  if (!sprint) {
    res.status(404).json({ error: "Sprint not found" });
    return;
  }

  res.json(GetSprintResponse.parse({
    ...sprint,
    startDate: sprint.startDate ?? null,
    endDate: sprint.endDate ?? null,
  }));
});

export default router;
