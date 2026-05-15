import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TerminalSquare, Loader2, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  key: string;
  aliases: string[];
  description: string;
  usage: string;
  category: string;
  enabled: boolean;
  limitCost: number;
}

async function fetchCommands(botId: string, token: string): Promise<CommandItem[]> {
  const [cmdRes, costRes] = await Promise.all([
    fetch(`/api/bots/${botId}/commands`, { headers: { Authorization: `Bearer ${token}` } }),
    fetch(`/api/bots/${botId}/commands/limit-cost`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!cmdRes.ok) throw new Error("Gagal memuat command");
  const data = await cmdRes.json();
  const costData = costRes.ok ? await costRes.json() : { limitCost: {} };
  const costMap: Record<string, number> = costData.limitCost ?? {};
  return (data.commands as Omit<CommandItem, "limitCost">[]).map((c) => ({
    ...c,
    limitCost: costMap[c.key] ?? 0,
  }));
}

async function patchLimitCost(botId: string, key: string, cost: number, token: string): Promise<void> {
  const res = await fetch(`/api/bots/${botId}/commands/${key}/limit-cost`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cost }),
  });
  if (!res.ok) throw new Error("Gagal menyimpan limit cost");
}

async function patchCommand(
  botId: string,
  key: string,
  enabled: boolean,
  token: string,
): Promise<void> {
  const res = await fetch(`/api/bots/${botId}/commands/${key}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Gagal mengubah command");
}

async function getFirstBotId(token: string): Promise<string | null> {
  const res = await fetch("/api/bots", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const bots = Array.isArray(data) ? data : (data.bots ?? []);
  return bots[0]?.id ?? bots[0]?._id ?? null;
}

export default function CommandsPage() {
  const { toast } = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);
  const token = accessToken ?? localStorage.getItem("accessToken") ?? "";

  const [botId, setBotId] = useState<string | null>(null);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [editingCost, setEditingCost] = useState<Record<string, string>>({});
  const [savingCost, setSavingCost] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let id = botId;
      if (!id) {
        id = await getFirstBotId(token);
        if (!id) throw new Error("Bot tidak ditemukan");
        setBotId(id);
      }
      const cmds = await fetchCommands(id, token);
      setCommands(cmds);
    } catch (e: any) {
      setError(e.message ?? "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveCost = async (key: string) => {
    if (!botId || savingCost.has(key)) return;
    const rawVal = editingCost[key];
    if (rawVal === undefined) return;
    const cost = parseInt(rawVal, 10);
    if (isNaN(cost) || cost < 0) {
      toast({ variant: "destructive", title: "Nilai tidak valid", description: "Limit cost harus angka >= 0" });
      return;
    }
    setSavingCost((prev) => new Set(prev).add(key));
    try {
      await patchLimitCost(botId, key, cost, token);
      setCommands((prev) => prev.map((c) => (c.key === key ? { ...c, limitCost: cost } : c)));
      setEditingCost((prev) => { const n = { ...prev }; delete n[key]; return n; });
      toast({ title: "Limit cost disimpan", description: `Perintah .${key} butuh ${cost} limit.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan limit cost." });
    } finally {
      setSavingCost((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const toggle = async (key: string, current: boolean) => {
    if (!botId || toggling.has(key)) return;
    const next = !current;

    setCommands((prev) =>
      prev.map((c) => (c.key === key ? { ...c, enabled: next } : c)),
    );
    setToggling((prev) => new Set(prev).add(key));

    try {
      await patchCommand(botId, key, next, token);
      toast({
        title: next ? "Command diaktifkan" : "Command dinonaktifkan",
        description: `Perintah .${key} berhasil ${next ? "diaktifkan" : "dinonaktifkan"}.`,
      });
    } catch {
      setCommands((prev) =>
        prev.map((c) => (c.key === key ? { ...c, enabled: current } : c)),
      );
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Tidak dapat mengubah status command.",
      });
    } finally {
      setToggling((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  };

  // Group by category
  const grouped = commands.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.category] ??= []).push(cmd);
    return acc;
  }, {});

  const enabledCount = commands.filter((c) => c.enabled).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Command</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola perintah yang bisa digunakan pengguna di WhatsApp
          </p>
        </div>
        {!loading && !error && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={load}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg border border-border">
              <span className="text-foreground font-semibold">{enabledCount}</span>
              <span> / {commands.length} aktif</span>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat command...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive/70" />
          <p className="text-sm">{error}</p>
          <button
            onClick={load}
            className="text-xs text-primary hover:underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Command list */}
      {!loading && !error && Object.entries(grouped).map(([category, cmds]) => (
        <div key={category} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
            {category}
          </p>

          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {cmds.map((cmd) => {
              const busy = toggling.has(cmd.key);
              return (
                <div
                  key={cmd.key}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 bg-card transition-colors",
                    !cmd.enabled && "opacity-60",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                      cmd.enabled
                        ? "bg-primary/10 border-primary/20 text-primary"
                        : "bg-secondary border-border text-muted-foreground",
                    )}
                  >
                    <TerminalSquare className="w-4 h-4" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {cmd.usage}
                      </span>
                      {cmd.aliases.length > 1 && (
                        <span className="text-[11px] text-muted-foreground/60 font-mono">
                          alias: {cmd.aliases.filter((a) => a !== cmd.key).map((a) => `.${a}`).join(", ")}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4 font-medium",
                          cmd.enabled
                            ? "border-green-500/30 text-green-500 bg-green-500/5"
                            : "border-zinc-500/30 text-zinc-500 bg-zinc-500/5",
                        )}
                      >
                        {cmd.enabled ? "aktif" : "nonaktif"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {cmd.description}
                    </p>
                  </div>

                  {/* Limit cost input */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <Zap className="w-3 h-3 text-blue-400" />
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="w-14 h-7 rounded-md border border-border bg-background text-xs text-center font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Limit yang dibutuhkan (0 = gratis)"
                      placeholder="0"
                      value={editingCost[cmd.key] ?? String(cmd.limitCost)}
                      onChange={(e) =>
                        setEditingCost((prev) => ({ ...prev, [cmd.key]: e.target.value }))
                      }
                      onBlur={() => {
                        const raw = editingCost[cmd.key];
                        if (raw !== undefined && raw !== String(cmd.limitCost)) {
                          saveCost(cmd.key);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCost(cmd.key);
                        if (e.key === "Escape") {
                          setEditingCost((prev) => { const n = { ...prev }; delete n[cmd.key]; return n; });
                        }
                      }}
                    />
                    {savingCost.has(cmd.key) && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Toggle */}
                  <div className="shrink-0">
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={cmd.enabled}
                        onCheckedChange={() => toggle(cmd.key, cmd.enabled)}
                        aria-label={`Toggle ${cmd.key}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Info box */}
      {!loading && !error && (
        <div className="rounded-xl border border-border bg-secondary/30 px-5 py-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground text-xs">ℹ️ Cara kerja</p>
          <p>Command yang dinonaktifkan tidak akan bisa dijalankan pengguna — bot akan membalas bahwa perintah sedang dinonaktifkan.</p>
          <div className="flex items-start gap-1.5 mt-1">
            <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p>
              <span className="text-foreground font-medium">Kolom limit</span> — isi angka berapa limit yang dibutuhkan untuk menjalankan command tersebut. Isi <span className="text-foreground font-medium">0</span> berarti gratis. Klik di luar kolom atau tekan <kbd className="bg-secondary border border-border rounded px-1">Enter</kbd> untuk menyimpan.
            </p>
          </div>
          <p>Perubahan berlaku <span className="text-foreground font-medium">langsung</span> tanpa perlu restart bot.</p>
        </div>
      )}
    </div>
  );
}
