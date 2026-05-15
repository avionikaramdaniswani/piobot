import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subscriptionsTable } from "@workspace/db";
import {
  ActivateSubscriptionBody,
  GetSubscriptionStatusParams,
  ExtendSubscriptionBody,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const PLANS = [
  {
    id: "free",
    name: "Free",
    features: ["ping", "menu", "info"],
    durationDays: 36500,
    price: 0,
  },
  {
    id: "basic",
    name: "Basic",
    features: ["ping", "menu", "info", "downloader", "sticker", "tools"],
    durationDays: 30,
    price: 4.99,
  },
  {
    id: "premium",
    name: "Premium",
    features: ["ping", "menu", "info", "downloader", "sticker", "tools", "all_features", "priority_support"],
    durationDays: 30,
    price: 9.99,
  },
];

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["ping", "menu", "info"],
  basic: ["ping", "menu", "info", "downloader", "sticker", "tools"],
  premium: ["ping", "menu", "info", "downloader", "sticker", "tools", "all_features", "priority_support"],
};

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

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  res.json(PLANS);
});

router.post("/subscriptions/activate", requireAuth, async (req, res): Promise<void> => {
  const parsed = ActivateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user!.userId;
  const { botId, plan, durationDays } = parsed.data;

  const planInfo = PLANS.find((p) => p.id === plan);
  if (!planInfo) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const days = durationDays ?? planInfo.durationDays;
  const features = PLAN_FEATURES[plan] ?? [];

  await db
    .update(subscriptionsTable)
    .set({ isActive: false })
    .where(and(eq(subscriptionsTable.userId, userId), eq(subscriptionsTable.botId, botId)));

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const [sub] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      botId,
      plan: plan as "free" | "basic" | "premium",
      startDate: new Date(),
      endDate,
      isActive: true,
      features,
    })
    .returning();

  res.json(formatSubscription(sub));
});

router.get("/subscriptions/status/:botId", requireAuth, async (req, res): Promise<void> => {
  const params = GetSubscriptionStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = req.user!.userId;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.botId, params.data.botId),
        eq(subscriptionsTable.userId, userId),
        eq(subscriptionsTable.isActive, true),
      ),
    )
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: "No active subscription found" });
    return;
  }

  res.json(formatSubscription(sub));
});

router.post("/subscriptions/extend", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = ExtendSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subscriptionId, durationDays } = parsed.data;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subscriptionId))
    .limit(1);

  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }

  const currentEnd = new Date(sub.endDate);
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + durationDays);

  const [updated] = await db
    .update(subscriptionsTable)
    .set({ endDate: newEnd })
    .where(eq(subscriptionsTable.id, subscriptionId))
    .returning();

  res.json(formatSubscription(updated));
});

export default router;
