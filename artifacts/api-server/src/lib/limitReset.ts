import { BotUser } from "../models/BotUser.js";
import { logger } from "./logger.js";

const DEFAULT_LIMIT = 25;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getMidnightWIB(): Date {
  const now = new Date();
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const midnightWIB = new Date(
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()),
  );
  const midnightUTC = new Date(midnightWIB.getTime() - WIB_OFFSET_MS);
  return midnightUTC;
}

function getMsUntilNextMidnightWIB(): number {
  const now = new Date();
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const tomorrowWIB = new Date(
    Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + 1),
  );
  const tomorrowUTC = new Date(tomorrowWIB.getTime() - WIB_OFFSET_MS);
  return tomorrowUTC.getTime() - now.getTime();
}

export async function resetAllLimits(): Promise<void> {
  const resetAt = getMidnightWIB();
  const result = await BotUser.updateMany(
    { limitResetAt: { $lt: resetAt } },
    { $set: { limit: DEFAULT_LIMIT, limitResetAt: new Date() } },
  );
  if (result.modifiedCount > 0) {
    logger.info({ count: result.modifiedCount }, "Daily limit reset for bot users");
  }
}

export function scheduleNextReset(): void {
  const ms = getMsUntilNextMidnightWIB();
  logger.info(
    { nextResetIn: `${Math.round(ms / 60000)} menit` },
    "Menjadwalkan reset limit harian (00.00 WIB)",
  );

  setTimeout(async () => {
    await resetAllLimits().catch((err) =>
      logger.error({ err }, "Gagal mereset limit harian"),
    );
    scheduleNextReset();
  }, ms);
}

export async function ensureBotUser(
  botId: string,
  senderJid: string,
  displayName?: string,
): Promise<import("../models/BotUser.js").IBotUser> {
  const midnight = getMidnightWIB();

  let user = await BotUser.findOne({ botId, senderJid });
  if (!user) {
    user = await BotUser.create({
      botId,
      senderJid,
      displayName: displayName ?? "",
      balance: 0,
      limit: DEFAULT_LIMIT,
      limitResetAt: new Date(),
    });
  } else {
    if (!user.limitResetAt || user.limitResetAt < midnight) {
      user.limit = DEFAULT_LIMIT;
      user.limitResetAt = new Date();
      await user.save();
    }
    if (displayName && displayName !== user.displayName) {
      user.displayName = displayName;
      await user.save();
    }
  }

  return user;
}
