import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, prdsTable } from "@workspace/db";
import {
  GetPrdParams,
  DeletePrdParams,
  GetPrdResponse,
  ListPrdsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/prds", async (_req, res): Promise<void> => {
  const prds = await db.select().from(prdsTable).orderBy(prdsTable.createdAt);
  res.json(ListPrdsResponse.parse(prds));
});

router.get("/prds/:id", async (req, res): Promise<void> => {
  const params = GetPrdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prd] = await db
    .select()
    .from(prdsTable)
    .where(eq(prdsTable.id, params.data.id));

  if (!prd) {
    res.status(404).json({ error: "PRD not found" });
    return;
  }

  res.json(GetPrdResponse.parse(prd));
});

router.delete("/prds/:id", async (req, res): Promise<void> => {
  const params = DeletePrdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prd] = await db
    .delete(prdsTable)
    .where(eq(prdsTable.id, params.data.id))
    .returning();

  if (!prd) {
    res.status(404).json({ error: "PRD not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
