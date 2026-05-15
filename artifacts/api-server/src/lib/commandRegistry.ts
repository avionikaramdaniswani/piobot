export interface CommandMeta {
  key: string;
  aliases: string[];
  description: string;
  usage: string;
  category: string;
}

export const COMMAND_REGISTRY: CommandMeta[] = [
  {
    key: "ping",
    aliases: ["ping", "p"],
    description: "Cek latensi / response time bot",
    usage: ".ping",
    category: "Utilitas",
  },
  {
    key: "menu",
    aliases: ["menu", "help", "start"],
    description: "Tampilkan daftar semua perintah yang tersedia",
    usage: ".menu",
    category: "Utilitas",
  },
  {
    key: "info",
    aliases: ["info"],
    description: "Tampilkan informasi lengkap tentang bot",
    usage: ".info",
    category: "Utilitas",
  },
  {
    key: "runtime",
    aliases: ["runtime", "uptime"],
    description: "Tampilkan waktu aktif bot sejak terakhir dinyalakan",
    usage: ".runtime",
    category: "Utilitas",
  },
  {
    key: "owner",
    aliases: ["owner"],
    description: "Tampilkan info kontak owner / admin",
    usage: ".owner",
    category: "Utilitas",
  },
  {
    key: "profile",
    aliases: ["profile", "profil", "me"],
    description: "Tampilkan profil kamu di bot ini (balance, limit, statistik)",
    usage: ".profile",
    category: "Akun",
  },
  {
    key: "swgc",
    aliases: ["swgc"],
    description: "Kirim status/story ke grup aktif (reply foto/video/teks + caption) — khusus owner & admin grup",
    usage: ".swgc [caption] atau kirim/reply foto/video + .swgc [caption]",
    category: "Grup",
  },
  {
    key: "swgcbyid",
    aliases: ["swgcbyid"],
    description: "Kirim status/story ke grup berdasarkan ID — khusus owner bot",
    usage: ".swgcbyid (id_grup) [caption] atau kirim/reply foto/video + .swgcbyid (id_grup) [caption]",
    category: "Grup",
  },
  {
    key: "showidgroup",
    aliases: ["showidgroup", "listgroup", "grupid"],
    description: "Tampilkan semua ID grup yang diikuti bot — khusus owner",
    usage: ".showidgroup",
    category: "Grup",
  },
  {
    key: "cekowner",
    aliases: ["cekowner"],
    description: "Cek apakah nomormu terdeteksi sebagai owner bot (debug)",
    usage: ".cekowner",
    category: "Grup",
  },
];

export const ALL_ALIASES = new Set(COMMAND_REGISTRY.flatMap((c) => c.aliases));

export function keyForAlias(alias: string): string | undefined {
  return COMMAND_REGISTRY.find((c) => c.aliases.includes(alias))?.key;
}
