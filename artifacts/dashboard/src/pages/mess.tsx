import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Loader2, AlertCircle, Save, RefreshCw,
  ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Schema definisi semua field Mess ────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  description: string;
  multiline: boolean;
  vars?: { name: string; desc: string }[];
}

interface SectionDef {
  title: string;
  desc: string;
  fields: FieldDef[];
}

const SCHEMA: SectionDef[] = [
  {
    title: "Feedback Umum",
    desc: "Pesan pendek yang muncul saat command gagal atau ditolak. Semuanya tanpa variable.",
    fields: [
      { key: "wait", label: "Loading wait", description: "Ditampilkan saat bot sedang memproses request yang butuh waktu.", multiline: false },
      { key: "error", label: "Error umum", description: "Fallback saat ada exception tak terduga di handler command.", multiline: false },
      { key: "invLink", label: "Link tidak valid", description: "User memberi URL yang tidak bisa di-parse atau bukan domain yang didukung.", multiline: false },
      { key: "onlyGrup", label: "Hanya di grup", description: "Command tidak bisa dipakai di chat pribadi.", multiline: false },
      { key: "onlyPM", label: "Hanya di private", description: "Command tidak bisa dipakai di grup.", multiline: false },
      { key: "grupAdmin", label: "Hanya admin grup", description: "User yang manggil command bukan admin grup.", multiline: false },
      { key: "botAdmin", label: "Bot harus admin", description: "Command butuh akses admin tapi bot belum diangkat jadi admin.", multiline: false },
      { key: "onlyOwner", label: "Hanya owner bot", description: "Command terbatas untuk owner bot.", multiline: false },
      { key: "onlyPrem", label: "Hanya premium", description: "Command khusus user premium.", multiline: false },
      { key: "onlySewa", label: "Hanya grup sewa", description: "Grup ini bukan grup yang menyewa bot.", multiline: false },
      { key: "call", label: "Tolak panggilan", description: "Auto-reply saat ada call masuk ke nomor bot.", multiline: false },
      { key: "timeout", label: "Timeout", description: "Operasi yang berjalan terlalu lama dibatalkan.", multiline: false },
    ],
  },
  {
    title: "Limit, Cooldown & Level",
    desc: "Pesan untuk sistem kuota harian, cooldown command, dan level user.",
    fields: [
      {
        key: "limit",
        label: "Limit harian habis",
        description: "Reset otomatis setiap hari.",
        multiline: true,
      },
      {
        key: "cmdLimit",
        label: "Info limit & balance",
        description: "Ringkasan limit user, biasanya dipakai di command \"limit\" atau \"balance\".",
        multiline: true,
        vars: [
          { name: "{limit}", desc: "Sisa limit user" },
          { name: "{balance}", desc: "Saldo balance user" },
          { name: "{prefix}", desc: "Prefix bot saat ini" },
        ],
      },
      {
        key: "requiredLimit",
        label: "Limit tidak cukup",
        description: "Saat user pakai fitur yang butuh lebih banyak limit dari yang dia punya.",
        multiline: true,
        vars: [
          { name: "{limit}", desc: "Limit yang user punya saat ini" },
          { name: "{requiredLimit}", desc: "Limit yang dibutuhkan" },
        ],
      },
      {
        key: "cooldown",
        label: "Command cooldown",
        description: "Command masih dalam masa cooldown sejak terakhir dipakai.",
        multiline: false,
        vars: [{ name: "{detik}", desc: "Sisa detik sebelum command bisa dipakai lagi" }],
      },
      {
        key: "level",
        label: "Level user kurang",
        description: "Level user belum cukup untuk pakai command tertentu.",
        multiline: true,
        vars: [
          { name: "{userLevel}", desc: "Level user saat ini" },
          { name: "{requiredLevel}", desc: "Level minimum yang dibutuhkan" },
        ],
      },
      {
        key: "levelup",
        label: "Notif naik level",
        description: "Dikirim otomatis saat user naik level.",
        multiline: true,
        vars: [
          { name: "{before}", desc: "Level sebelumnya" },
          { name: "{level}", desc: "Level baru" },
          { name: "{tier}", desc: "Tier baru" },
          { name: "{xp}", desc: "XP user saat ini" },
          { name: "{maxXp}", desc: "XP maksimal di level baru" },
        ],
      },
    ],
  },
  {
    title: "Event Grup",
    desc: "Auto-broadcast oleh bot saat ada event di grup: join, leave, promote, anti-spam, ulang tahun.",
    fields: [
      {
        key: "welcomeText",
        label: "Sambutan member baru",
        description: "Dikirim saat ada user join grup.",
        multiline: true,
        vars: [
          { name: "{user}", desc: "Tag member baru" },
          { name: "{user_pn}", desc: "Nomor telepon member baru" },
          { name: "{author}", desc: "Yang menambahkan member (admin)" },
          { name: "{group}", desc: "Nama grup" },
          { name: "{desc}", desc: "Deskripsi grup" },
          { name: "{tanggal}", desc: "Tanggal saat event terjadi" },
          { name: "{wib}", desc: "Jam WIB" },
        ],
      },
      {
        key: "leftText",
        label: "Pesan member keluar",
        description: "Dikirim saat ada user leave atau di-kick dari grup.",
        multiline: true,
        vars: [
          { name: "{user}", desc: "Tag user yang keluar" },
          { name: "{user_pn}", desc: "Nomor telepon user yang keluar" },
          { name: "{author}", desc: "Yang men-kick user (admin)" },
          { name: "{group}", desc: "Nama grup" },
        ],
      },
      {
        key: "promoteText",
        label: "Notif promote admin",
        description: "Dikirim saat ada user dijadikan admin grup.",
        multiline: true,
        vars: [
          { name: "{sender}", desc: "User yang dipromote" },
          { name: "{author}", desc: "Admin yang melakukan promote" },
          { name: "{tanggal}", desc: "Tanggal saat event terjadi" },
          { name: "{wib}", desc: "Jam WIB" },
        ],
      },
      {
        key: "demoteText",
        label: "Notif demote admin",
        description: "Dikirim saat status admin user dicabut.",
        multiline: true,
        vars: [
          { name: "{sender}", desc: "User yang didemote" },
          { name: "{author}", desc: "Admin yang melakukan demote" },
          { name: "{tanggal}", desc: "Tanggal saat event terjadi" },
        ],
      },
      {
        key: "antidelete",
        label: "Anti-delete trigger",
        description: "Dikirim ulang saat ada pesan yang dihapus oleh pengirimnya.",
        multiline: true,
        vars: [
          { name: "{sender}", desc: "Pengirim pesan yang dihapus" },
          { name: "{type}", desc: "Tipe pesan yang dihapus" },
          { name: "{time}", desc: "Waktu event antidelete dipicu" },
        ],
      },
      {
        key: "antiluar",
        label: "Anti foreign number",
        description: "Notif saat fitur anti-luar aktif dan ada nomor non-Indonesia masuk grup.",
        multiline: true,
        vars: [
          { name: "{sender}", desc: "User yang akan di-kick" },
          { name: "{sender_pn}", desc: "Nomor telepon user yang akan di-kick" },
        ],
      },
      {
        key: "ultah",
        label: "Selamat ulang tahun",
        description: "Auto-broadcast saat ulang tahun member terdeteksi.",
        multiline: true,
        vars: [{ name: "{user}", desc: "Tag member yang ulang tahun" }],
      },
    ],
  },
  {
    title: "Premium & Sewa",
    desc: "Pesan terkait status premium user dan masa sewa grup.",
    fields: [
      { key: "upgradepremium", label: "Konfirmasi premium aktif", description: "Dikirim ke user setelah pembayaran premium tervalidasi.", multiline: false },
      { key: "expiredpremium", label: "Premium habis", description: "Notif saat masa premium user expired.", multiline: false },
      { key: "sewaReminder", label: "Pengingat sewa <24 jam", description: "Dikirim ke grup saat masa sewa tinggal <24 jam.", multiline: false },
      { key: "sewaEnd", label: "Sewa habis (di grup)", description: "Dikirim ke grup saat masa sewa benar-benar berakhir.", multiline: false },
      {
        key: "sewaNotif",
        label: "Notif sewa habis (ke owner)",
        description: "Notifikasi untuk owner bot saat ada grup yang sewa-nya habis.",
        multiline: true,
        vars: [
          { name: "{groupId}", desc: "ID grup WhatsApp" },
          { name: "{subject}", desc: "Nama grup" },
        ],
      },
      {
        key: "joinToUse",
        label: "Wajib gabung group/channel",
        description: "Dikirim saat fitur joinToUse aktif dan user belum gabung.",
        multiline: true,
      },
    ],
  },
  {
    title: "Downloader",
    desc: "Caption yang menyertai output download dari YouTube, TikTok, dan Twitter.",
    fields: [
      {
        key: "ytmp3",
        label: "YouTube audio (ytmp3)",
        description: "Caption sebelum file audio dikirim ke user.",
        multiline: true,
        vars: [
          { name: "{title}", desc: "Judul video YouTube" },
          { name: "{size}", desc: "Ukuran file audio" },
          { name: "{bitrate}", desc: "Bitrate audio (kbps)" },
        ],
      },
      {
        key: "ytmp4",
        label: "YouTube video (ytmp4)",
        description: "Caption sebelum file video dikirim ke user.",
        multiline: true,
        vars: [
          { name: "{title}", desc: "Judul video YouTube" },
          { name: "{size}", desc: "Ukuran file video" },
          { name: "{quality}", desc: "Resolusi video (mis. 720p)" },
        ],
      },
      {
        key: "play",
        label: "Play YouTube (detail)",
        description: "Detail lengkap saat user pakai command play.",
        multiline: true,
        vars: [
          { name: "{title}", desc: "Judul video" },
          { name: "{url}", desc: "URL video" },
          { name: "{filesize}", desc: "Ukuran file" },
          { name: "{reso}", desc: "Resolusi atau bitrate" },
          { name: "{timestamp}", desc: "Durasi video" },
          { name: "{views}", desc: "Jumlah views" },
          { name: "{authorName}", desc: "Nama channel" },
        ],
      },
      {
        key: "tiktok",
        label: "TikTok info",
        description: "Caption saat download TikTok.",
        multiline: true,
        vars: [
          { name: "{username}", desc: "Username uploader" },
          { name: "{nickname}", desc: "Nickname uploader" },
          { name: "{type}", desc: "Tipe konten (video / image)" },
          { name: "{description}", desc: "Caption video" },
        ],
      },
      {
        key: "twitter",
        label: "Twitter info",
        description: "Caption saat download Twitter / X.",
        multiline: true,
        vars: [
          { name: "{username}", desc: "Username uploader" },
          { name: "{likes}", desc: "Jumlah likes" },
          { name: "{caption}", desc: "Caption / isi tweet" },
        ],
      },
    ],
  },
  {
    title: "Profil User",
    desc: "Tampilan info user di command profile / me.",
    fields: [
      {
        key: "profile",
        label: "Layout profil",
        description: "Layout lengkap info user, termasuk stat mini-game.",
        multiline: true,
        vars: [
          { name: "{pushname}", desc: "Nama display WhatsApp user" },
          { name: "{number}", desc: "Nomor user" },
          { name: "{status}", desc: "Status user (Owner / Premium / Free)" },
          { name: "{limit}", desc: "Sisa limit harian" },
          { name: "{balance}", desc: "Saldo balance" },
          { name: "{level}", desc: "Level" },
          { name: "{xp}", desc: "XP user saat ini" },
          { name: "{day}", desc: "Tanggal user terdaftar" },
          { name: "{month}", desc: "Bulan user terdaftar" },
          { name: "{year}", desc: "Tahun user terdaftar" },
        ],
      },
    ],
  },
  {
    title: "Countdown",
    desc: "Format yang dipakai bot saat hitung mundur.",
    fields: [
      {
        key: "countdown",
        label: "Format countdown",
        description: "Dipakai saat countdown masih berjalan.",
        multiline: false,
        vars: [
          { name: "{days}", desc: "Sisa hari" },
          { name: "{hours}", desc: "Sisa jam" },
          { name: "{minutes}", desc: "Sisa menit" },
          { name: "{seconds}", desc: "Sisa detik" },
        ],
      },
      { key: "countdownEnd", label: "Label saat countdown selesai", description: "Ditampilkan ketika hitung mundur sudah habis.", multiline: false },
    ],
  },
  {
    title: "Alarm, Reminder & Confess",
    desc: "Template untuk pesan alarm, reminder, dan form confess.",
    fields: [
      {
        key: "alarm",
        label: "Alarm",
        description: "Pesan yang dikirim saat alarm berbunyi.",
        multiline: true,
        vars: [{ name: "{text}", desc: "Teks alarm yang user set saat membuat alarm" }],
      },
      {
        key: "reminder",
        label: "Reminder",
        description: "Pesan yang dikirim saat reminder jatuh tempo.",
        multiline: true,
        vars: [{ name: "{text}", desc: "Teks reminder dari user" }],
      },
      { key: "confess", label: "Template confess", description: "Form yang dikirim balik ke user saat dia pakai command confess tanpa argumen.", multiline: true },
    ],
  },
];

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = {
  wait: "*_Loading..._*",
  error: "Maaf terjadi kesalahan",
  invLink: "Link yang kamu berikan tidak valid",
  onlyGrup: "Perintah ini hanya bisa digunakan di grup",
  onlyPM: "Perintah ini hanya bisa digunakan di private message",
  grupAdmin: "Perintah ini hanya bisa digunakan oleh Admin Grup",
  botAdmin: "Bot Harus menjadi admin",
  onlyOwner: "Perintah ini hanya dapat digunakan oleh owner bot",
  onlyPrem: "Perintah ini khusus member premium",
  onlySewa: "Perintah ini khusus group sewa",
  call: "Maaf bot tidak menerima call",
  timeout: "Timeout",
  limit: "Maaf limit harian kamu sudah habis, beli premium untuk mendapatkan limit Unlimited, atau kamu dapat menunggu reset limit pada pukul 05.05 setiap harinya",
  cmdLimit: "Limit kamu adalah *{limit}* dan balance kamu adalah *{balance}*\n\nKamu dapat membeli premium user untuk mendapatkan limit unlimited, ketik {prefix}owner\n\nLimit akan diriset pada pukul 05.05 setiap harinya",
  requiredLimit: "Limit yang kamu miliki tidak cukup untuk menggunakan fitur ini\n\nLimit kamu: {limit}\nLimit dibutuhkan: {requiredLimit}",
  cooldown: "Command sedang cooldown, harap tunggu {detik} detik lagi",
  level: "Maaf level anda {userLevel}, untuk menggunakan command ini minimal harus level {requiredLevel}",
  levelup: "Selamat kamu naik level\n\nLevel : {before} -> {level}\nTier : {tier}\nXP : {xp}/{maxXp}",
  welcomeText: "Hai @{user}, selamat datang di {group}",
  leftText: "Bye @{user}",
  promoteText: "*PROMOTE DETECTED!*\nSelamat kepada @{sender} telah menjadi admin.",
  demoteText: "*DEMOTE DETECTED!*\nTerdeteksi @{sender} telah di unadmin.",
  antidelete: "*[ Anti delete ]*\n\n• Sender : @{sender}\n• Type : {type}\n• Time : {time}",
  antiluar: "Hello @{sender}, this group is only for Indonesian people and you will be removed automatically",
  ultah: "Selamat ulang tahun kepada @{user} 🎉🎉!!!\n\nSemoga panjang umur dan sehat selalu 🎂",
  upgradepremium: "Selamat nomor anda sudah upgrade ke premium",
  expiredpremium: "Status premium anda sudah habis, silahkan hubungi owner untuk memperpanjang premium",
  sewaReminder: "Waktu sewa di grup ini kurang dari 24 jam, silahkan hubungi owner untuk memperpanjang masa sewa",
  sewaEnd: "Waktu sewa di grup ini sudah habis, silahkan hubungi owner untuk memperpanjang masa sewa",
  sewaNotif: "*Sewa Notification*\n\nId: {groupId}\nName: {subject}\n\nMasa sewa group tersebut sudah habis",
  joinToUse: "Ups...\nKamu belum masuk group, silahkan masuk group untuk menggunakan bot ini...",
  ytmp3: "*[ YOUTUBE AUDIO ]*\n\n• Title : {title}\n• Size : {size}\n• Quality : {bitrate}kbps\n\n_Harap tunggu sebentar, audio anda akan segera dikirim_",
  ytmp4: "*[ YOUTUBE VIDEO ]*\n\n• Title : {title}\n• Size : {size}\n• Quality : {quality}\n\n_Harap tunggu sebentar, video anda akan segera dikirim_",
  play: "*[ PLAY YOUTUBE ]*\n\n• Title : {title}\n• Url : {url}\n• Size : {filesize}\n• Resolusi/Bitrate : {reso}\n• Timestamp : {timestamp}\n• Views  : {views}\n• Author Name  : {authorName}\n\n_Harap tunggu sebentar, permintaan anda akan segera dikirim_",
  tiktok: "*[ Tiktok Downloader ]*\n\n- Username : {username}\n- Nickname : {nickname}\n- Type : {type}\n- Description : {description}",
  twitter: "*[Twitter Downloader]*\n\nUsername : {username}\nLike : {likes}\nCaption :\n{caption}",
  profile: "╭────✎「 *User Info* 」\n│• Name: {pushname}\n│• Tag: @{number}\n│• Status: {status}\n│• Limit: {limit}\n│• Balance: {balance}\n│• Member since: {day}/{month}/{year}\n╰─────────❍",
  countdown: "{days} days, {hours} hours, {minutes} minutes, {seconds} seconds",
  countdownEnd: "berakhir",
  alarm: "{text}",
  reminder: "{text}",
  confess: "*Contoh pengisian form*:\n\nNama Pengirim: Nama kamu\nNomor Penerima: 628111111\nPesan: Hai aku suka kamu <3\n\n*Note:*\nNomor penerima harus berformat internasional, *62* bukan *08*",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFirstBotId(token: string): Promise<string | null> {
  const res = await fetch("/api/bots", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const bots = Array.isArray(data) ? data : (data.bots ?? []);
  return bots[0]?.id ?? bots[0]?._id ?? null;
}

async function fetchMessages(botId: string, token: string): Promise<Record<string, string>> {
  const res = await fetch(`/api/bots/${botId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Gagal memuat pesan bot");
  const data = await res.json();
  return data.messages ?? {};
}

async function saveMessages(botId: string, token: string, messages: Record<string, string>): Promise<void> {
  const res = await fetch(`/api/bots/${botId}/messages`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error("Gagal menyimpan pesan bot");
}

// ─── Field Editor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showVars, setShowVars] = useState(false);
  const hasVars = field.vars && field.vars.length > 0;
  const isDirty = value !== (DEFAULTS[field.key] ?? "");

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{field.label}</span>
            <code className="text-[10px] font-mono bg-secondary border border-border px-1.5 py-0.5 rounded text-muted-foreground">
              {field.key}
            </code>
            {isDirty && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-medium">
                diubah
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
        </div>
        {hasVars && (
          <button
            onClick={() => setShowVars((p) => !p)}
            className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <Info className="w-3 h-3" />
            Variabel
            <ChevronDown className={cn("w-3 h-3 transition-transform", showVars && "rotate-180")} />
          </button>
        )}
      </div>

      {showVars && hasVars && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {field.vars!.map((v) => (
            <button
              key={v.name}
              title={v.desc}
              onClick={() => onChange(value + v.name)}
              className="flex items-center gap-1 text-[11px] bg-secondary border border-border rounded px-2 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors font-mono"
            >
              {v.name}
              <span className="font-sans text-[10px] text-muted-foreground/60 ml-0.5 hidden sm:inline">{v.desc}</span>
            </button>
          ))}
        </div>
      )}

      {field.multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(3, value.split("\n").length + 1)}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors min-h-[72px]"
          placeholder={DEFAULTS[field.key] ?? ""}
          spellCheck={false}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          placeholder={DEFAULTS[field.key] ?? ""}
          spellCheck={false}
        />
      )}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  section,
  values,
  onChange,
}: {
  section: SectionDef;
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const dirtyCount = section.fields.filter(
    (f) => values[f.key] !== undefined && values[f.key] !== (DEFAULTS[f.key] ?? ""),
  ).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-secondary/40 hover:bg-secondary/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">{section.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <span className="text-xs text-muted-foreground">{section.fields.length} field</span>
          {dirtyCount > 0 && (
            <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
              {dirtyCount} diubah
            </Badge>
          )}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border bg-card">
          {section.fields.map((field) => (
            <div key={field.key} className="px-5 py-4">
              <FieldEditor
                field={field}
                value={values[field.key] ?? DEFAULTS[field.key] ?? ""}
                onChange={(v) => onChange(field.key, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MessPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const token = accessToken ?? localStorage.getItem("accessToken") ?? "";
  const { toast } = useToast();

  const [botId, setBotId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Record<string, string>>({});

  const totalFields = SCHEMA.reduce((a, s) => a + s.fields.length, 0);
  const dirtyCount = Object.entries(values).filter(
    ([k, v]) => v !== (DEFAULTS[k] ?? ""),
  ).length;

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    setError(null);
    try {
      const saved = await fetchMessages(bid, token);
      const merged: Record<string, string> = { ...DEFAULTS };
      for (const [k, v] of Object.entries(saved)) {
        if (typeof v === "string") merged[k] = v;
      }
      setValues(merged);
      pendingRef.current = {};
    } catch (e: any) {
      setError(e.message ?? "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      const id = await getFirstBotId(token);
      if (!id) { setError("Bot tidak ditemukan"); setLoading(false); return; }
      setBotId(id);
      await load(id);
    })();
  }, []);

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    pendingRef.current[key] = val;
  };

  const handleSave = async () => {
    if (!botId) return;
    setSaving(true);
    try {
      await saveMessages(botId, token, values);
      pendingRef.current = {};
      toast({ title: "Pesan bot berhasil disimpan" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (key: string) => {
    const def = DEFAULTS[key] ?? "";
    setValues((prev) => ({ ...prev, [key]: def }));
    pendingRef.current[key] = def;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pesan Bot</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atur kalimat-kalimat yang bot kirim otomatis. Token <code className="text-xs bg-secondary px-1 rounded">{"{contoh}"}</code> akan diganti bot dengan data sungguhan saat runtime.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!loading && !error && (
            <>
              <button
                onClick={() => botId && load(botId)}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <Button size="sm" onClick={handleSave} disabled={saving || dirtyCount === 0} className="h-8 px-3 gap-1.5 text-xs">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="rounded-xl border border-border bg-secondary/30 px-5 py-3 flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span><span className="text-foreground font-semibold">{totalFields}</span> field total</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary/70" />
            <span><span className="text-foreground font-semibold">{dirtyCount}</span> belum disimpan</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-muted-foreground/60">Klik nama variabel untuk sisipkan ke editor</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat pesan bot...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive/70" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Sections */}
      {!loading && !error && (
        <div className="space-y-4">
          {SCHEMA.map((section) => (
            <Section
              key={section.title}
              section={section}
              values={values}
              onChange={handleChange}
            />
          ))}
        </div>
      )}

      {/* Sticky save bar when dirty */}
      {!loading && !error && dirtyCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 bg-card border border-border shadow-xl rounded-xl px-4 py-2.5">
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground font-semibold">{dirtyCount}</span> perubahan belum disimpan
            </span>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 px-3 gap-1.5 text-xs">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan sekarang
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
