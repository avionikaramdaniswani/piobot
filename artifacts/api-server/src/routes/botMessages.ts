import { Router, type IRouter } from "express";
import { Bot } from "../models/Bot.js";
import { BotMessages } from "../models/BotMessages.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/bots/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  const doc = await BotMessages.findOne({ botId: bot._id }).lean();
  const messages: Record<string, string> = {};
  if (doc?.messages) {
    (doc.messages as any).forEach((val: string, key: string) => {
      messages[key] = val;
    });
  }

  res.json({ messages });
});

router.patch("/bots/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const bot = await Bot.findOne({ _id: req.params.id, ownerId: userId });
  if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }

  const incoming: Record<string, string> = req.body.messages ?? {};
  if (typeof incoming !== "object" || Array.isArray(incoming)) {
    res.status(400).json({ error: "messages harus berupa object" }); return;
  }

  let doc = await BotMessages.findOne({ botId: bot._id });
  if (!doc) {
    doc = new BotMessages({ botId: bot._id, messages: {} });
  }

  for (const [key, val] of Object.entries(incoming)) {
    if (typeof val === "string") doc.messages.set(key, val);
  }
  doc.markModified("messages");
  await doc.save();

  const result: Record<string, string> = {};
  doc.messages.forEach((v, k) => { result[k] = v; });
  res.json({ messages: result });
});

export default router;
