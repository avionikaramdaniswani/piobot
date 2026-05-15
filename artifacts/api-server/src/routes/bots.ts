import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { Bot, type IBot } from "../models/Bot";
import { Subscription, type ISubscription } from "../models/Subscription";
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
import {
  startWhatsAppBot,
  stopWhatsAppBot,
  getBotQRCode,
  requestBotPairingCode,
} from "../lib/whatsapp";
import { botLogEmitter, type BotLogEvent } from "../lib/botLogger";
import { COMMAND_REGISTRY } from "../lib/commandRegistry";

const router: IRouter = Router();

function formatSub(sub: ISubscription | null | undefined) {
  if (!sub) return null;
  return {
    id: sub._id.toString(),
    userId: sub.userId.toString(),
    botId: sub.botId.toString(),
    plan: sub.plan,
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate.toISOString(),
    isActive: sub.isActive,
    features: sub.features,
  };
}

function formatBot(bot: IBot, subscription?: ISubscription | null) {
  const prefixes = bot.prefixes && bot.prefixes.length > 0 ? bot.prefixes : [bot.prefix];
  return {
    id: bot._id.toString(),
    ownerId: bot.ownerId.toString(),
    name: bot.name,
    phoneNumber: bot.phoneNumber ?? null,
    status: bot.status,
    prefix: bot.prefix,
    prefixes,
    owners: bot.owners ?? [],
    connectedAt: bot.connectedAt ? bot.connectedAt.toISOString() : null,
    createdAt: bot.createdAt.toISOString(),
    ...(subscription !== undefined ? { subscription: formatSub(subscription) } : {}),
  };
}

router.get("/bots/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bots = await Bot.find({ ownerId: userId });
  res.json({
    total: bots.length,
    connected: bots.filter((b) => b.status === "connected").length,
    connecting: bots.filter((b) => b.status === "connecting").length,
    inactive: bots.filter((b) => b.status === "inactive").length,
    disconnected: bots.filter((b) => b.status === "disconnected").length,
  });
});

router.get("/bots", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bots = await Bot.find({ ownerId: userId }).sort({ createdAt: -1 });
  const botIds = bots.map((b) => b._id);
  const subs = await Subscription.find({ userId, botId: { $in: botIds }, isActive: true });
  const subMap = new Map(subs.map((s) => [s.botId.toString(), s]));
  res.json(bots.map((b) => formatBot(b, subMap.get(b._id.toString()) ?? null)));
});

router.post("/bots", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user!.userId;

  const existingBot = await Bot.findOne({ ownerId: userId });
  if (existingBot) {
    res.status(409).json({ error: "Setiap akun hanya dapat memiliki 1 bot." });
    return;
  }

  const { name, phoneNumber, prefix } = parsed.data;
  const bot = await Bot.create({
    ownerId: userId,
    name,
    phoneNumber: phoneNumber ?? null,
    prefix: prefix ?? ".",
  });
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 99);
  await Subscription.create({
    userId,
    botId: bot._id,
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
  const bot = await Bot.findOne({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const sub = await Subscription.findOne({ botId: bot._id, isActive: true });
  res.json(formatBot(bot, sub ?? null));
});

router.patch("/bots/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    const update: Record<string, any> = {};
    if (req.body.name && typeof req.body.name === "string") update.name = req.body.name.trim();
    if (req.body.prefix && typeof req.body.prefix === "string") update.prefix = req.body.prefix.trim();
    if (Array.isArray(req.body.prefixes)) {
      const clean = req.body.prefixes
        .map((p: any) => (typeof p === "string" ? p.trim() : ""))
        .filter((p: string) => p.length > 0 && p.length <= 5);
      if (clean.length > 0) {
        update.prefixes = clean;
        update.prefix = clean[0];
      }
    }
    if (Array.isArray(req.body.owners)) {
      const clean = req.body.owners
        .filter((o: any) => o && typeof o.name === "string" && typeof o.phoneNumber === "string")
        .map((o: any) => ({ name: o.name.trim(), phoneNumber: o.phoneNumber.trim() }))
        .filter((o: any) => o.name && o.phoneNumber)
        .slice(0, 3);
      update.owners = clean;
    }
    const updated = await Bot.findByIdAndUpdate(bot._id, update, { returnDocument: "after" });
    const sub = await Subscription.findOne({ botId: bot._id, isActive: true });
    res.json(formatBot(updated!, sub ?? null));
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
});

router.delete("/bots/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.userId;
  const bot = await Bot.findOneAndDelete({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopWhatsAppBot(params.data.id);
  await Subscription.deleteMany({ botId: params.data.id });
  res.json({ success: true });
});

router.delete("/bots/:id/session", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopWhatsAppBot(req.params.id);
  await Bot.findByIdAndUpdate(bot._id, { phoneNumber: null, status: "inactive" });
  res.json({ success: true });
});

router.post("/bots/:id/start", requireAuth, async (req, res): Promise<void> => {
  const params = StartBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await Bot.findByIdAndUpdate(bot._id, { status: "connecting" });

  startWhatsAppBot(params.data.id).catch((err) => {
    req.log.error({ err, botId: params.data.id }, "Failed to start WhatsApp bot");
  });

  const updated = await Bot.findById(bot._id);
  res.json(formatBot(updated!));
});

router.post("/bots/:id/stop", requireAuth, async (req, res): Promise<void> => {
  const params = StopBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  await stopWhatsAppBot(params.data.id);
  const updated = await Bot.findById(bot._id);
  res.json(formatBot(updated!));
});

router.get("/bots/:id/status", requireAuth, async (req, res): Promise<void> => {
  const params = GetBotStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  res.json({
    id: bot._id.toString(),
    status: bot.status,
    phoneNumber: bot.phoneNumber ?? null,
  });
});

router.get("/bots/:id/qrcode", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  const qrCode = getBotQRCode(String(req.params.id));
  res.json({ qrCode });
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
  const bot = await Bot.findOne({ _id: params.data.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  try {
    const code = await requestBotPairingCode(params.data.id, body.data.phoneNumber);
    await Bot.findByIdAndUpdate(bot._id, { phoneNumber: body.data.phoneNumber });
    res.json({ code });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Gagal membuat kode pairing" });
  }
});

// ── GET /bots/:id/commands — list commands with enabled state ──────────────────
router.get("/bots/:id/commands", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const commandsMap: Record<string, boolean> = {};
  bot.commands.forEach((val, key) => { commandsMap[key] = val; });

  const result = COMMAND_REGISTRY.map((cmd) => ({
    key: cmd.key,
    aliases: cmd.aliases,
    description: cmd.description,
    usage: cmd.usage,
    category: cmd.category,
    enabled: commandsMap[cmd.key] !== false,
  }));

  res.json({ commands: result });
});

// ── PATCH /bots/:id/commands/:key — toggle command enabled state ──────────────
router.patch("/bots/:id/commands/:key", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const cmdKey = req.params.key;
  const validKey = COMMAND_REGISTRY.find((c) => c.key === cmdKey);
  if (!validKey) {
    res.status(400).json({ error: "Command tidak dikenal" });
    return;
  }

  const { enabled } = req.body as { enabled: boolean };
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "Field 'enabled' harus boolean" });
    return;
  }

  bot.commands.set(cmdKey, enabled);
  bot.markModified("commands");
  await bot.save();

  res.json({ key: cmdKey, enabled });
});

// ── SSE log stream ─────────────────────────────────────────────────────────────
// EventSource doesn't support custom headers, so we accept the JWT via ?token=
router.get("/bots/:id/logs", async (req, res): Promise<void> => {
  const token =
    (req.headers.authorization?.split(" ")[1]) ||
    (req.query.token as string | undefined);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let userId: string;
  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(token, secret) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if ((res as any).flush) (res as any).flush();
  };

  // Welcome message
  send({
    level: "muted",
    message: "Log stream terhubung — menunggu aktivitas bot...",
    timestamp: new Date().toISOString(),
  });

  // Keep-alive ping every 25s so the connection doesn't time out
  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
    if ((res as any).flush) (res as any).flush();
  }, 25_000);

  const onLog = (event: BotLogEvent) => send(event);
  botLogEmitter.on(`log:${req.params.id}`, onLog);

  req.on("close", () => {
    clearInterval(keepAlive);
    botLogEmitter.off(`log:${req.params.id}`, onLog);
    res.end();
  });
});

export default router;
