import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import botsRouter from "./bots";
import subscriptionsRouter from "./subscriptions";
import botUsersRouter from "./botUsers";
import botMessagesRouter from "./botMessages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(botsRouter);
router.use(subscriptionsRouter);
router.use(botUsersRouter);
router.use(botMessagesRouter);

export default router;
