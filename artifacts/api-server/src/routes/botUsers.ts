import { Router, type IRouter } from "express";
import { Bot } from "../models/Bot";
import { BotUser } from "../models/BotUser";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/bots/:id/users", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  const search = (req.query.search as string) ?? "";

  const filter: Record<string, any> = { botId: bot._id };
  if (search) {
    filter.$or = [
      { senderJid: { $regex: search, $options: "i" } },
      { displayName: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    BotUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    BotUser.countDocuments(filter),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u._id.toString(),
      senderJid: u.senderJid,
      displayName: u.displayName,
      balance: u.balance,
      limit: u.limit,
      limitResetAt: u.limitResetAt?.toISOString() ?? null,
      totalCommandsUsed: u.totalCommandsUsed,
      createdAt: (u as any).createdAt?.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.patch("/bots/:id/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const ownerId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const botUser = await BotUser.findOne({ _id: req.params.userId, botId: bot._id });
  if (!botUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { balance, limit } = req.body;
  if (typeof balance === "number" && balance >= 0) botUser.balance = balance;
  if (typeof limit === "number" && limit >= 0) botUser.limit = limit;
  await botUser.save();

  res.json({
    id: botUser._id.toString(),
    senderJid: botUser.senderJid,
    displayName: botUser.displayName,
    balance: botUser.balance,
    limit: botUser.limit,
    limitResetAt: botUser.limitResetAt?.toISOString() ?? null,
    totalCommandsUsed: botUser.totalCommandsUsed,
  });
});

router.post("/bots/:id/users/:userId/add-balance", requireAuth, async (req, res): Promise<void> => {
  const ownerId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const botUser = await BotUser.findOne({ _id: req.params.userId, botId: bot._id });
  if (!botUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { amount } = req.body;
  if (typeof amount !== "number" || amount === 0) {
    res.status(400).json({ error: "amount harus berupa angka bukan nol" });
    return;
  }

  botUser.balance = Math.max(0, botUser.balance + amount);
  await botUser.save();

  res.json({ balance: botUser.balance, limit: botUser.limit });
});

router.post("/bots/:id/users/:userId/add-limit", requireAuth, async (req, res): Promise<void> => {
  const ownerId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const botUser = await BotUser.findOne({ _id: req.params.userId, botId: bot._id });
  if (!botUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { amount } = req.body;
  if (typeof amount !== "number" || amount === 0) {
    res.status(400).json({ error: "amount harus berupa angka bukan nol" });
    return;
  }

  botUser.limit = Math.max(0, botUser.limit + amount);
  await botUser.save();

  res.json({ balance: botUser.balance, limit: botUser.limit });
});

router.get("/bots/:id/commands/limit-cost", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const costMap: Record<string, number> = {};
  bot.commandLimitCost.forEach((val, key) => {
    costMap[key] = val;
  });

  res.json({ limitCost: costMap });
});

router.patch("/bots/:id/commands/:key/limit-cost", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const { cost } = req.body;
  if (typeof cost !== "number" || cost < 0) {
    res.status(400).json({ error: "cost harus berupa angka >= 0" });
    return;
  }

  bot.commandLimitCost.set(req.params.key, cost);
  bot.markModified("commandLimitCost");
  await bot.save();

  res.json({ key: req.params.key, cost });
});

// ── GET /bots/:id/commands/owner-only — get ownerOnly map ─────────────────────
router.get("/bots/:id/commands/owner-only", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const ownerOnlyMap: Record<string, boolean> = {};
  bot.commandOwnerOnly.forEach((val, key) => {
    ownerOnlyMap[key] = val;
  });

  res.json({ ownerOnly: ownerOnlyMap });
});

// ── PATCH /bots/:id/commands/:key/owner-only — set ownerOnly for a command ────
router.patch("/bots/:id/commands/:key/owner-only", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const { ownerOnly } = req.body;
  if (typeof ownerOnly !== "boolean") {
    res.status(400).json({ error: "ownerOnly harus berupa boolean" });
    return;
  }

  bot.commandOwnerOnly.set(req.params.key, ownerOnly);
  bot.markModified("commandOwnerOnly");
  await bot.save();

  res.json({ key: req.params.key, ownerOnly });
});

export default router;
