import makeWASocket, {
  DisconnectReason,
  Browsers,
  WAMessage,
} from "ourin-baileys";
import pino from "pino";
import { Bot } from "../models/Bot.js";
import { logger } from "./logger.js";
import { useMongoAuthState, deleteMongoAuthState } from "./mongoAuthState.js";
import { emitBotLog } from "./botLogger.js";
import { keyForAlias } from "./commandRegistry.js";
import { ensureBotUser } from "./limitReset.js";

const activeSockets = new Map<string, ReturnType<typeof makeWASocket>>();
const qrCodes = new Map<string, string>();
const botPrefixes = new Map<string, string[]>();

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
  botId: string;
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
defineCommand(["menu", "help", "start"], async ({ sock, jid, prefix, botName, isGroup, botId }) => {
  const botDoc = await Bot.findById(botId).lean();
  const prefixList: string[] = (botDoc as any)?.prefixes?.length
    ? (botDoc as any).prefixes
    : [prefix];
  const prefixDisplay = prefixList.map((p) => `\`${p}\``).join(", ");
  const text = [
    `╔══════════════════════╗`,
    `║   🤖 *${botName}*`,
    `╚══════════════════════╝`,
    ``,
    `📌 *Prefix:* ${prefixDisplay}`,
    `📍 *Mode:* ${isGroup ? "Grup" : "Private"}`,
    ``,
    `━━━ 📋 *PERINTAH* ━━━`,
    ``,
    `🔧 *Utilitas*`,
    `${prefix}ping       - Cek latensi bot`,
    `${prefix}menu       - Tampilkan menu ini`,
    `${prefix}info       - Info bot`,
    `${prefix}runtime    - Waktu aktif bot`,
    `${prefix}owner      - Kontak owner`,
    ``,
    `👤 *Akun*`,
    `${prefix}profile    - Lihat profil & saldo kamu`,
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
defineCommand(["owner"], async ({ sock, jid, botId }) => {
  const botDoc = await Bot.findById(botId).lean();
  const owners: Array<{ name: string; phoneNumber: string }> = (botDoc as any)?.owners ?? [];
  if (owners.length === 0) {
    await sock.sendMessage(jid, { text: `👤 *Owner Bot*\n\nTidak ada owner yang terdaftar.` });
    return;
  }
  const lines = owners.map((o, i) => `${i + 1}. *${o.name}* — wa.me/${o.phoneNumber.replace(/\D/g, "")}`);
  await sock.sendMessage(jid, {
    text: `👤 *Owner Bot*\n\n${lines.join("\n")}`,
  });
});

// .profile / .profil / .me
defineCommand(["profile", "profil", "me"], async ({ sock, jid, sender, botId, botName, prefix }) => {
  const senderJid = sender || jid;

  // Ensure BotUser exists (will create with default values if first time)
  const botUser = await ensureBotUser(botId, senderJid);

  // Build display number (strip @s.whatsapp.net / :XX@)
  const rawNum = senderJid.split("@")[0]?.split(":")[0] ?? senderJid;
  const displayNum = rawNum.length > 8
    ? `+${rawNum.slice(0, 4)}****${rawNum.slice(-4)}`
    : `+${rawNum}`;

  const displayName = botUser.displayName || displayNum;

  // Limit bar visual (out of 25 default)
  const DEFAULT_LIMIT = 25;
  const limitPct = Math.round((botUser.limit / DEFAULT_LIMIT) * 10);
  const limitBar =
    "█".repeat(Math.max(0, limitPct)) +
    "░".repeat(Math.max(0, 10 - limitPct));

  // Balance bar (cap at 1000 for display)
  const balanceCap = 1000;
  const balancePct = Math.min(10, Math.round((botUser.balance / balanceCap) * 10));
  const balanceBar =
    "█".repeat(Math.max(0, balancePct)) +
    "░".repeat(Math.max(0, 10 - balancePct));

  // Next reset time — always 00.00 WIB tomorrow
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(Date.now() + WIB_OFFSET);
  const tomorrowWIB = new Date(
    Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), nowWIB.getUTCDate() + 1),
  );
  const resetUTC = new Date(tomorrowWIB.getTime() - WIB_OFFSET);
  const msLeft = resetUTC.getTime() - Date.now();
  const hLeft = Math.floor(msLeft / 3_600_000);
  const mLeft = Math.floor((msLeft % 3_600_000) / 60_000);
  const resetCountdown = `${hLeft}j ${mLeft}m`;

  // Member since
  const joined = new Date((botUser as any).createdAt ?? Date.now());
  const joinedStr = joined.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  // Limit status label
  const limitStatus =
    botUser.limit === 0
      ? "🔴 Habis"
      : botUser.limit < 5
      ? "🟡 Hampir habis"
      : "🟢 Normal";

  const text = [
    `╔══════════════════════╗`,
    `║   👤 *PROFIL PENGGUNA*   ║`,
    `╚══════════════════════╝`,
    ``,
    `🏷️ *Nama*     : ${displayName}`,
    `📱 *Nomor*    : ${displayNum}`,
    `📅 *Bergabung*: ${joinedStr}`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *BALANCE*`,
    `  Saldo  : *${botUser.balance.toLocaleString("id-ID")}* koin`,
    `  [${balanceBar}]`,
    ``,
    `⚡ *LIMIT HARIAN*`,
    `  Sisa   : *${botUser.limit} / ${DEFAULT_LIMIT}* limit`,
    `  Status : ${limitStatus}`,
    `  [${limitBar}]`,
    `  Reset  : *${resetCountdown}* lagi (00.00 WIB)`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *STATISTIK*`,
    `  Total command : *${botUser.totalCommandsUsed.toLocaleString("id-ID")}x*`,
    ``,
    `> Ketik *${prefix}menu* untuk melihat semua perintah`,
  ].join("\n");

  await sock.sendMessage(jid, { text });
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

function shortJid(jid: string): string {
  const num = jid.split("@")[0]?.split(":")[0] ?? jid;
  return num.length > 8 ? `+${num.slice(0, 4)}...${num.slice(-4)}` : `+${num}`;
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

    const prefixes = botPrefixes.get(botId) ?? ["."];
    const trimmed = text.trim();

    const isGroup = jid.endsWith("@g.us");
    const sender = getSender(msg);
    const senderShort = shortJid(sender || jid);
    const chatLabel = isGroup ? "grup" : "private";

    // Find which prefix was used (longest match first to avoid ambiguity)
    const sorted = [...prefixes].sort((a, b) => b.length - a.length);
    const matchedPrefix = sorted.find((p) => trimmed.startsWith(p));

    if (!matchedPrefix) {
      emitBotLog(botId, `Pesan ${chatLabel} dari ${senderShort}`, "muted");
      return;
    }

    const withoutPrefix = trimmed.slice(matchedPrefix.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    logger.info({ botId, jid, isGroup, commandName }, "Command received");
    emitBotLog(botId, `Perintah ${matchedPrefix}${commandName} dari ${senderShort} [${chatLabel}]`, "info");

    const handler = commands.get(commandName);
    if (!handler) {
      emitBotLog(botId, `Perintah "${matchedPrefix}${commandName}" tidak dikenal`, "warn");
      await sock.sendMessage(jid, {
        text: `❓ Perintah *${matchedPrefix}${commandName}* tidak dikenal.\n\nKetik *${matchedPrefix}menu* untuk melihat daftar perintah.`,
      });
      return;
    }

    // Check if this command is disabled by the owner + check limit
    const cmdKey = keyForAlias(commandName);
    if (cmdKey) {
      const botDoc = await Bot.findById(botId).lean();
      const commandsMap = (botDoc as any)?.commands as Map<string, boolean> | Record<string, boolean> | undefined;
      let enabled = true;
      if (commandsMap) {
        const val = commandsMap instanceof Map ? commandsMap.get(cmdKey) : (commandsMap as Record<string, boolean>)[cmdKey];
        if (val === false) enabled = false;
      }
      if (!enabled) {
        emitBotLog(botId, `Perintah ${matchedPrefix}${commandName} dinonaktifkan oleh owner`, "warn");
        await sock.sendMessage(jid, {
          text: `🚫 Perintah *${matchedPrefix}${commandName}* sedang dinonaktifkan.`,
        });
        return;
      }

      // ── Limit check ──────────────────────────────────────────────────────
      const limitCostMap = (botDoc as any)?.commandLimitCost as Record<string, number> | undefined;
      const limitCost = limitCostMap ? (limitCostMap[cmdKey] ?? 0) : 0;

      if (limitCost > 0) {
        const pushName = (msg as any)?.pushName ?? "";
        const botUser = await ensureBotUser(botId, sender || jid, pushName);

        if (botUser.limit < limitCost) {
          emitBotLog(botId, `${senderShort} limit habis saat mencoba ${matchedPrefix}${commandName}`, "warn");
          await sock.sendMessage(jid, {
            text: `⚠️ *Limit kamu habis!*\n\n` +
              `Limit kamu: *${botUser.limit}/${25}*\n` +
              `Butuh: *${limitCost} limit*\n\n` +
              `Limit akan direset otomatis setiap hari pukul *00.00 WIB*.\n` +
              `Atau beli limit menggunakan balance kamu. 💰`,
          });
          return;
        }

        botUser.limit -= limitCost;
        botUser.totalCommandsUsed += 1;
        await botUser.save();
        emitBotLog(botId, `${senderShort} pakai ${limitCost} limit untuk ${matchedPrefix}${commandName} (sisa: ${botUser.limit})`, "muted");
      }
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
      prefix: matchedPrefix,
      botId,
      quotedMsg: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ?? undefined,
    });

    emitBotLog(botId, `Berhasil menjalankan ${matchedPrefix}${commandName}`, "success");
    await sock.sendPresenceUpdate("paused", jid);
  } catch (err) {
    logger.error({ botId, err }, "Error handling message");
    emitBotLog(botId, `Error saat memproses pesan`, "error");
  }
}

// ─── Socket Lifecycle ─────────────────────────────────────────────────────────

export async function startWhatsAppBot(botId: string): Promise<void> {
  if (activeSockets.has(botId)) {
    logger.info({ botId }, "Bot socket already running");
    return;
  }

  emitBotLog(botId, "Memulai koneksi ke WhatsApp...", "info");

  const botDoc = await Bot.findById(botId);
  const botName = botDoc?.name ?? "WhatsApp Bot";
  const rawPrefixes = botDoc?.prefixes && botDoc.prefixes.length > 0
    ? botDoc.prefixes
    : [botDoc?.prefix ?? "."];
  botPrefixes.set(botId, rawPrefixes);
  const prefix = rawPrefixes[0];

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
      emitBotLog(botId, "QR code dibuat — silakan scan dengan WhatsApp", "info");
      await Bot.findByIdAndUpdate(botId, { status: "connecting" });
    }

    if (connection === "open") {
      qrCodes.delete(botId);
      logger.info({ botId }, "WhatsApp connected");
      const phoneNumber = sock.user?.id?.split(":")[0]?.split("@")[0];
      const displayNumber = phoneNumber ? `+${phoneNumber}` : "nomor baru";
      await Bot.findByIdAndUpdate(botId, {
        status: "connected",
        connectedAt: new Date(),
        ...(phoneNumber ? { phoneNumber: `+${phoneNumber}` } : {}),
      });
      emitBotLog(botId, `Terhubung ke WhatsApp — ${displayNumber}`, "success");
      emitBotLog(botId, `Bot aktif dengan prefix "${prefix}", siap menerima perintah`, "success");
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
        emitBotLog(botId, "Sesi berakhir — akun WhatsApp keluar", "error");
        await deleteMongoAuthState(botId);
        logger.info({ botId }, "Session data wiped from MongoDB after logout");
      } else {
        emitBotLog(botId, `Koneksi terputus (kode: ${code ?? "?"}) — mencoba ulang dalam 5 detik...`, "warn");
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
  emitBotLog(botId, "Bot dihentikan", "muted");
  logger.info({ botId }, "Bot stopped");
}

export function getBotQRCode(botId: string): string | null {
  return qrCodes.get(botId) ?? null;
}

export async function requestBotPairingCode(botId: string, phoneNumber: string): Promise<string> {
  const sock = activeSockets.get(botId);
  if (!sock) throw new Error("Bot tidak berjalan. Nyalakan bot terlebih dahulu.");

  const clean = phoneNumber.replace(/[^0-9]/g, "");
  emitBotLog(botId, `Membuat kode pairing untuk +${clean}...`, "info");
  const code = await sock.requestPairingCode(clean);
  emitBotLog(botId, `Kode pairing dibuat: ${code}`, "success");
  logger.info({ botId, phoneNumber: clean }, "Pairing code requested");
  return code;
}

export function isBotRunning(botId: string): boolean {
  return activeSockets.has(botId);
}
