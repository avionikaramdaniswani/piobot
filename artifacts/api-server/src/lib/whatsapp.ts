import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
} from "ourin-baileys";
import pino from "pino";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { Bot } from "../models/Bot";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = path.resolve(__dirname, "../../sessions");

const activeSockets = new Map<string, ReturnType<typeof makeWASocket>>();
const qrCodes = new Map<string, string>();

const silentLogger = pino({ level: "silent" });

async function ensureSessionDir(botId: string): Promise<string> {
  const dir = path.join(SESSIONS_DIR, botId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function startWhatsAppBot(botId: string): Promise<void> {
  if (activeSockets.has(botId)) {
    logger.info({ botId }, "Bot socket already running");
    return;
  }

  const sessionDir = await ensureSessionDir(botId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: silentLogger,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    qrTimeout: 60_000,
  });

  activeSockets.set(botId, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrCodes.set(botId, qr);
      logger.info({ botId }, "QR code generated");
      await Bot.findByIdAndUpdate(botId, { status: "connecting" });
    }

    if (connection === "open") {
      qrCodes.delete(botId);
      logger.info({ botId }, "WhatsApp connected");
      const info = sock.user;
      const phoneNumber = info?.id?.split(":")[0]?.split("@")[0];
      await Bot.findByIdAndUpdate(botId, {
        status: "connected",
        ...(phoneNumber ? { phoneNumber: `+${phoneNumber}` } : {}),
      });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      qrCodes.delete(botId);
      activeSockets.delete(botId);

      logger.info({ botId, code, loggedOut }, "WhatsApp connection closed");
      await Bot.findByIdAndUpdate(botId, { status: loggedOut ? "inactive" : "disconnected" });

      if (!loggedOut) {
        logger.info({ botId }, "Reconnecting in 5s...");
        setTimeout(() => startWhatsAppBot(botId), 5000);
      }
    }
  });
}

export async function stopWhatsAppBot(botId: string): Promise<void> {
  const sock = activeSockets.get(botId);
  if (sock) {
    try {
      sock.ws?.close();
    } catch {}
    activeSockets.delete(botId);
    qrCodes.delete(botId);
  }
  await Bot.findByIdAndUpdate(botId, { status: "disconnected" });
  logger.info({ botId }, "Bot stopped");
}

export function getBotQRCode(botId: string): string | null {
  return qrCodes.get(botId) ?? null;
}

export async function requestBotPairingCode(botId: string, phoneNumber: string): Promise<string> {
  const sock = activeSockets.get(botId);
  if (!sock) throw new Error("Bot tidak berjalan. Nyalakan bot terlebih dahulu.");

  const clean = phoneNumber.replace(/[^0-9]/g, "");
  const code = await sock.requestPairingCode(clean);
  logger.info({ botId, phoneNumber: clean }, "Pairing code requested");
  return code;
}

export function isBotRunning(botId: string): boolean {
  return activeSockets.has(botId);
}
