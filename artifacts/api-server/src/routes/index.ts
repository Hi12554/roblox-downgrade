import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientVersionRouter from "./client-version";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientVersionRouter);

export default router;
