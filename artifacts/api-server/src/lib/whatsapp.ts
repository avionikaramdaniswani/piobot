import makeWASocket, {
  DisconnectReason,
  Browsers,
  WAMessage,
} from "ourin-baileys";
import pino from "pino";
import { Bot } from "../models/Bot.js";
import { logger } from "./logger.js";
import { useMongoAuthState, deleteMongoAuthState } from "./mongoAuthState.js";

const activeSockets = new Map<string, ReturnType<typeof makeWASocket>>();
const qrCodes = new Map<string, string>();
const botPrefixes = new Map<string, string>();

const silentLogger = pino({ level: "silent" });

// ─── Command Handlers ─────────────────────────────────────────────────────────

type CommandContext = {
  sock: ReturnType<typeof makeWASocket>;
  jid: string;
  sender: string;
  isGroup: boolean;
  args: string[];
  fullText: string;
  botName: string;
  prefix: string;
  quotedMsg?: WAMessage["message"];
};

type CommandHandler = (ctx: CommandContext) => Promise<void>;

const commands = new Map<string, CommandHandler>();

function defineCommand(names: string[], handler: CommandHandler) {
  for (const name of names) commands.set(name, handler);
}

// .ping / .p
defineCommand(["ping", "p"], async ({ sock, jid }) => {
  const start = Date.now();
  await sock.sendMessage(jid, { text: "🏓 Pong! Mengukur latensi..." });
  const latency = Date.now() - start;
  await sock.sendMessage(jid, { text: `⚡ Latensi: *${latency}ms*` });
});

// .menu / .help / .start
defineCommand(["menu", "help", "start"], async ({ sock, jid, prefix, botName, isGroup }) => {
  const text = [
    `╔══════════════════════╗`,
    `║   🤖 *${botName}*`,
    `╚══════════════════════╝`,
    ``,
    `📌 *Prefix:* \`${prefix}\``,
    `📍 *Mode:* ${isGroup ? "Grup" : "Private"}`,
    ``,
    `━━━ 📋 *PERINTAH* ━━━`,
    ``,
    `${prefix}ping       - Cek latensi bot`,
    `${prefix}menu       - Tampilkan menu ini`,
    `${prefix}info       - Info bot`,
    `${prefix}runtime    - Waktu aktif bot`,
    `${prefix}owner      - Kontak owner`,
    ``,
    `> Ketik perintah di atas untuk memulai!`,
  ].join("\n");

  await sock.sendMessage(jid, { text });
});

// .info
defineCommand(["info"], async ({ sock, jid, botName, prefix, isGroup }) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);

  const text = [
    `🤖 *Informasi Bot*`,
    ``,
    `• Nama: *${botName}*`,
    `• Prefix: *${prefix}*`,
    `• Platform: *WhatsApp*`,
    `• Mode: *${isGroup ? "Grup" : "Private"}*`,
    `• Runtime: *${h}j ${m}m ${s}d*`,
    `• Framework: *ourin-baileys*`,
    ``,
    `✅ Bot aktif dan siap menerima perintah!`,
  ].join("\n");

  await sock.sendMessage(jid, { text });
});

// .runtime
defineCommand(["runtime", "uptime"], async ({ sock, jid }) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  await sock.sendMessage(jid, {
    text: `⏱️ Bot sudah aktif selama:\n*${h} jam ${m} menit ${s} detik*`,
  });
});

// .owner
defineCommand(["owner"], async ({ sock, jid }) => {
  await sock.sendMessage(jid, {
    text: `👤 *Owner Bot*\n\nHubungi admin/owner melalui platform dashboard.`,
  });
});

// ─── Message Handler ──────────────────────────────────────────────────────────

function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    null
  );
}

function getSender(msg: WAMessage): string {
  return msg.key.participant || msg.key.remoteJid || "";
}

async function handleMessage(
  botId: string,
  sock: ReturnType<typeof makeWASocket>,
  msg: WAMessage,
  botName: string,
) {
  try {
    const jid = msg.key.remoteJid;
    if (!jid) return;

    if (msg.key.fromMe) return;
    if (jid === "status@broadcast") return;

    const text = extractText(msg);
    if (!text) return;

    const prefix = botPrefixes.get(botId) ?? ".";
    const trimmed = text.trim();

    if (!trimmed.startsWith(prefix)) return;

    const isGroup = jid.endsWith("@g.us");
    const sender = getSender(msg);

    const withoutPrefix = trimmed.slice(prefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    logger.info({ botId, jid, isGroup, commandName }, "Command received");

    const handler = commands.get(commandName);
    if (!handler) {
      await sock.sendMessage(jid, {
        text: `❓ Perintah *${prefix}${commandName}* tidak dikenal.\n\nKetik *${prefix}menu* untuk melihat daftar perintah.`,
      });
      return;
    }

    await sock.sendPresenceUpdate("composing", jid);

    await handler({
      sock,
      jid,
      sender,
      isGroup,
      args,
      fullText: withoutPrefix,
      botName,
      prefix,
      quotedMsg: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ?? undefined,
    });

    await sock.sendPresenceUpdate("paused", jid);
  } catch (err) {
    logger.error({ botId, err }, "Error handling message");
  }
}

// ─── Socket Lifecycle ─────────────────────────────────────────────────────────

export async function startWhatsAppBot(botId: string): Promise<void> {
  if (activeSockets.has(botId)) {
    logger.info({ botId }, "Bot socket already running");
    return;
  }

  const botDoc = await Bot.findById(botId);
  const botName = botDoc?.name ?? "WhatsApp Bot";
  const prefix = botDoc?.prefix ?? ".";
  botPrefixes.set(botId, prefix);

  const { state, saveCreds } = await useMongoAuthState(botId);

  const sock = makeWASocket({
    auth: state,
    logger: silentLogger,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    qrTimeout: 60_000,
    markOnlineOnConnect: true,
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
      const phoneNumber = sock.user?.id?.split(":")[0]?.split("@")[0];
      await Bot.findByIdAndUpdate(botId, {
        status: "connected",
        connectedAt: new Date(),
        ...(phoneNumber ? { phoneNumber: `+${phoneNumber}` } : {}),
      });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;

      qrCodes.delete(botId);
      activeSockets.delete(botId);
      botPrefixes.delete(botId);

      logger.info({ botId, code, loggedOut }, "WhatsApp connection closed");
      await Bot.findByIdAndUpdate(botId, {
        status: loggedOut ? "inactive" : "disconnected",
        connectedAt: null,
      });

      if (loggedOut) {
        // Wipe session data from MongoDB on explicit logout
        await deleteMongoAuthState(botId);
        logger.info({ botId }, "Session data wiped from MongoDB after logout");
      } else {
        logger.info({ botId }, "Reconnecting in 5s...");
        setTimeout(() => startWhatsAppBot(botId), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      await handleMessage(botId, sock, msg, botName);
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
    botPrefixes.delete(botId);
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
