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
];

export const ALL_ALIASES = new Set(COMMAND_REGISTRY.flatMap((c) => c.aliases));

export function keyForAlias(alias: string): string | undefined {
  return COMMAND_REGISTRY.find((c) => c.aliases.includes(alias))?.key;
}
