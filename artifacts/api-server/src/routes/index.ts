import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import botsRouter from "./bots";
import subscriptionsRouter from "./subscriptions";
import botUsersRouter from "./botUsers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(botsRouter);
router.use(subscriptionsRouter);
router.use(botUsersRouter);

export default router;
