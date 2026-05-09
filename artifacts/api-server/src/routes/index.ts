import { Router, type IRouter } from "express";
import healthRouter from "./health";
import versionsRouter from "./versions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(versionsRouter);

export default router;
