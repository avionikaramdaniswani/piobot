import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, botsTable, subscriptionsTable } from "@workspace/db";
import {
  CreateBotBody,
  GetBotParams,
  DeleteBotParams,
  StartBotParams,
  StopBotParams,
  GetBotStatusParams,
  RequestPairingParams,
  RequestPairingBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatBot(bot: typeof botsTable.$inferSelect, subscription?: typeof subscriptionsTable.$inferSelect | null) {
  return {
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    phoneNumber: bot.phoneNumber ?? null,
    status: bot.status,
    prefix: bot.prefix,
    createdAt: bot.createdAt.toISOString(),
    ...(subscription !== undefined ? {
      subscription: subscription ? formatSubscription(subscription) : null,
    } : {}),
  };
}

function formatSubscription(sub: typeof subscriptionsTable.$inferSelect) {
  return {
    id: sub.id,
    userId: sub.userId,
    botId: sub.botId,
    plan: sub.plan,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
    isActive: sub.isActive,
    features: sub.features,
  };
}

router.get("/bots/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const bots = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.ownerId, userId));

  const stats = {
    total: bots.length,
    connected: bots.filter((b) => b.status === "connected").length,
    connecting: bots.filter((b) => b.status === "connecting").length,
    inactive: bots.filter((b) => b.status === "inactive").length,
    disconnected: bots.filter((b) => b.status === "disconnected").length,
  };

  res.json(stats);
});

router.get("/bots", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const bots = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.ownerId, userId));

  const botIds = bots.map((b) => b.id);

  const subs = botIds.length > 0
    ? await db
        .select()
        .from(subscriptionsTable)
        .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.isActive, true)))
    : [];

  const subMap = new Map(subs.map((s) => [s.botId, s]));

  res.json(bots.map((b) => formatBot(b, subMap.get(b.id) ?? null)));
});

router.post("/bots", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const { name, phoneNumber, prefix } = parsed.data;

  const [bot] = await db
    .insert(botsTable)
    .values({
      ownerId: userId,
      name,
      phoneNumber: phoneNumber ?? null,
      prefix: prefix ?? ".",
    })
    .returning();

  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 99);

  await db.insert(subscriptionsTable).values({
    userId,
    botId: bot.id,
    plan: "free",
    startDate: new Date(),
    endDate,
    isActive: true,
    features: ["ping", "menu", "info"],
  });

  res.status(201).json(formatBot(bot));
});

router.get("/bots/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.botId, bot.id), eq(subscriptionsTable.isActive, true)))
    .limit(1);

  res.json(formatBot(bot, sub ?? null));
});

router.delete("/bots/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  await db.delete(botsTable).where(eq(botsTable.id, bot.id));

  res.json({ success: true, message: "Bot deleted" });
});

router.post("/bots/:id/start", requireAuth, async (req, res): Promise<void> => {
  const params = StartBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set({ status: "connecting" })
    .where(eq(botsTable.id, bot.id))
    .returning();

  res.json(formatBot(updated));
});

router.post("/bots/:id/stop", requireAuth, async (req, res): Promise<void> => {
  const params = StopBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set({ status: "disconnected" })
    .where(eq(botsTable.id, bot.id))
    .returning();

  res.json(formatBot(updated));
});

router.get("/bots/:id/status", requireAuth, async (req, res): Promise<void> => {
  const params = GetBotStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  res.json({
    id: bot.id,
    status: bot.status,
    phoneNumber: bot.phoneNumber ?? null,
  });
});

router.post("/bots/:id/pairing", requireAuth, async (req, res): Promise<void> => {
  const params = RequestPairingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RequestPairingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, params.data.id), eq(botsTable.ownerId, userId)))
    .limit(1);

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  await db
    .update(botsTable)
    .set({ phoneNumber: body.data.phoneNumber, status: "connecting" })
    .where(eq(botsTable.id, bot.id));

  const digits = Math.floor(10000000 + Math.random() * 90000000).toString();
  const code = `${digits.slice(0, 4)}-${digits.slice(4)}`;

  res.json({ code });
});

export default router;
