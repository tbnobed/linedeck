import { Router, type IRouter } from "express";
import healthRouter from "./health";
import linesRouter from "./lines";
import vmsRouter from "./vms";
import pcrsRouter from "./pcrs";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(linesRouter);
router.use(vmsRouter);
router.use(pcrsRouter);
router.use(eventsRouter);

export default router;
