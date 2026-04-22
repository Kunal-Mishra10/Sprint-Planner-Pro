import { Router, type IRouter } from "express";
import healthRouter from "./health";
import featuresRouter from "./features";
import prdsRouter from "./prds";
import tasksRouter from "./tasks";
import sprintsRouter from "./sprints";
import adminRouter from "./admin";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(featuresRouter);
router.use(prdsRouter);
router.use(tasksRouter);
router.use(sprintsRouter);
router.use(adminRouter);
router.use(aiRouter);

export default router;
