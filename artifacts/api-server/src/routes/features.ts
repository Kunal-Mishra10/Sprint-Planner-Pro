import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, featuresTable } from "@workspace/db";
import {
  CreateFeatureBody,
  GetFeatureParams,
  DeleteFeatureParams,
  GetFeatureResponse,
  ListFeaturesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/features", async (_req, res): Promise<void> => {
  const features = await db
    .select()
    .from(featuresTable)
    .orderBy(featuresTable.createdAt);
  res.json(ListFeaturesResponse.parse(features));
});

router.post("/features", async (req, res): Promise<void> => {
  const parsed = CreateFeatureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [feature] = await db
    .insert(featuresTable)
    .values({ ...parsed.data, status: "pending" })
    .returning();

  res.status(201).json(GetFeatureResponse.parse(feature));
});

router.get("/features/:id", async (req, res): Promise<void> => {
  const params = GetFeatureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [feature] = await db
    .select()
    .from(featuresTable)
    .where(eq(featuresTable.id, params.data.id));

  if (!feature) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }

  res.json(GetFeatureResponse.parse(feature));
});

router.delete("/features/:id", async (req, res): Promise<void> => {
  const params = DeleteFeatureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [feature] = await db
    .delete(featuresTable)
    .where(eq(featuresTable.id, params.data.id))
    .returning();

  if (!feature) {
    res.status(404).json({ error: "Feature not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
