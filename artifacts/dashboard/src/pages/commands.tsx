import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TerminalSquare,
  Loader2,
  AlertCircle,
  RefreshCw,
  Zap,
  ChevronRight,
  Tag,
  Hash,
  AlignLeft,
  Settings2,
} from "lucide-react";
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

async function patchCommand(botId: string, key: string, enabled: boolean, token: string): Promise<void> {
  const res = await fetch(`/api/bots/${botId}/commands/${key}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("Gagal mengubah command");
}

async function getFirstBotId(token: string): Promise<string | null> {
  const res = await fetch("/api/bots", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const bots = Array.isArray(data) ? data : (data.bots ?? []);
  return bots[0]?.id ?? bots[0]?._id ?? null;
}

function CommandDetailModal({
  cmd,
  botId,
  token,
  onClose,
  onUpdate,
}: {
  cmd: CommandItem;
  botId: string;
  token: string;
  onClose: () => void;
  onUpdate: (updated: CommandItem) => void;
}) {
  const { toast } = useToast();
  const [localCmd, setLocalCmd] = useState<CommandItem>(cmd);
  const [costInput, setCostInput] = useState(String(cmd.limitCost));
  const [savingCost, setSavingCost] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    if (toggling) return;
    const next = !localCmd.enabled;
    setLocalCmd((prev) => ({ ...prev, enabled: next }));
    setToggling(true);
    try {
      await patchCommand(botId, localCmd.key, next, token);
      onUpdate({ ...localCmd, enabled: next });
      toast({
        title: next ? "Command diaktifkan" : "Command dinonaktifkan",
        description: `Perintah .${localCmd.key} berhasil ${next ? "diaktifkan" : "dinonaktifkan"}.`,
      });
    } catch {
      setLocalCmd((prev) => ({ ...prev, enabled: !next }));
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat mengubah status command." });
    } finally {
      setToggling(false);
    }
  };

  const handleSaveCost = async () => {
    if (savingCost) return;
    const cost = parseInt(costInput, 10);
    if (isNaN(cost) || cost < 0) {
      toast({ variant: "destructive", title: "Nilai tidak valid", description: "Limit cost harus angka >= 0" });
      return;
    }
    setSavingCost(true);
    try {
      await patchLimitCost(botId, localCmd.key, cost, token);
      const updated = { ...localCmd, limitCost: cost };
      setLocalCmd(updated);
      onUpdate(updated);
      toast({ title: "Limit cost disimpan", description: `Perintah .${localCmd.key} butuh ${cost} limit.` });
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat menyimpan limit cost." });
    } finally {
      setSavingCost(false);
    }
  };

  const otherAliases = localCmd.aliases.filter((a) => a !== localCmd.key);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0",
                localCmd.enabled
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : "bg-secondary border-border text-muted-foreground",
              )}
            >
              <TerminalSquare className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-mono text-base">
                .{localCmd.key}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{localCmd.category}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <div className="rounded-lg bg-secondary/40 border border-border/50 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              <AlignLeft className="w-3 h-3" />
              Deskripsi
            </div>
            <p className="text-sm text-foreground">{localCmd.description}</p>
          </div>

          {/* Usage */}
          <div className="rounded-lg bg-secondary/40 border border-border/50 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              <Hash className="w-3 h-3" />
              Penggunaan
            </div>
            <p className="font-mono text-sm text-foreground bg-background/60 rounded px-2 py-1 border border-border/40 inline-block">
              {localCmd.usage}
            </p>
          </div>

          {/* Aliases */}
          {otherAliases.length > 0 && (
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                <Tag className="w-3 h-3" />
                Alias
              </div>
              <div className="flex flex-wrap gap-1.5">
                {otherAliases.map((a) => (
                  <span
                    key={a}
                    className="font-mono text-xs bg-background/60 border border-border/40 rounded px-2 py-0.5 text-muted-foreground"
                  >
                    .{a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border">
              <Settings2 className="w-3.5 h-3.5 text-muted-foreground/60" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Pengaturan
              </p>
            </div>

            {/* Status toggle */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60">
              <div>
                <p className="text-sm font-medium text-foreground">Status Command</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {localCmd.enabled ? "Command aktif dan bisa digunakan" : "Command dinonaktifkan"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {toggling && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                <Switch
                  checked={localCmd.enabled}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                  aria-label={`Toggle ${localCmd.key}`}
                />
              </div>
            </div>

            {/* Limit cost */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-sm font-medium text-foreground">Limit Cost</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Jumlah limit yang dikurangi saat command dipakai
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={0}
                  className="w-16 h-8 rounded-md border border-border bg-background text-sm text-center font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCost();
                    if (e.key === "Escape") setCostInput(String(localCmd.limitCost));
                  }}
                />
                <button
                  onClick={handleSaveCost}
                  disabled={savingCost || costInput === String(localCmd.limitCost)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs font-medium transition-colors",
                    costInput !== String(localCmd.limitCost) && !savingCost
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed",
                  )}
                >
                  {savingCost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [selectedCmd, setSelectedCmd] = useState<CommandItem | null>(null);

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

  const handleQuickToggle = async (e: React.MouseEvent, key: string, current: boolean) => {
    e.stopPropagation();
    if (!botId || toggling.has(key)) return;
    const next = !current;
    setCommands((prev) => prev.map((c) => (c.key === key ? { ...c, enabled: next } : c)));
    setToggling((prev) => new Set(prev).add(key));
    try {
      await patchCommand(botId, key, next, token);
      toast({
        title: next ? "Command diaktifkan" : "Command dinonaktifkan",
        description: `Perintah .${key} berhasil ${next ? "diaktifkan" : "dinonaktifkan"}.`,
      });
    } catch {
      setCommands((prev) => prev.map((c) => (c.key === key ? { ...c, enabled: current } : c)));
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat mengubah status command." });
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const handleCommandUpdate = (updated: CommandItem) => {
    setCommands((prev) => prev.map((c) => (c.key === updated.key ? updated : c)));
    setSelectedCmd(updated);
  };

  const grouped = commands.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    (acc[cmd.category] ??= []).push(cmd);
    return acc;
  }, {});

  const enabledCount = commands.filter((c) => c.enabled).length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Command</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola perintah yang bisa digunakan pengguna di WhatsApp. Klik command untuk melihat detail & pengaturan.
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
          <button onClick={load} className="text-xs text-primary hover:underline">
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
              const otherAliases = cmd.aliases.filter((a) => a !== cmd.key);
              return (
                <div
                  key={cmd.key}
                  onClick={() => setSelectedCmd(cmd)}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 bg-card transition-colors cursor-pointer group",
                    "hover:bg-secondary/40",
                    !cmd.enabled && "opacity-60",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
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
                      {otherAliases.length > 0 && (
                        <span className="text-[11px] text-muted-foreground/60 font-mono">
                          alias: {otherAliases.map((a) => `.${a}`).join(", ")}
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

                  {/* Limit cost badge */}
                  <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Zap className="w-3 h-3 text-blue-400" />
                    <span className="font-mono text-[11px]">{cmd.limitCost}</span>
                  </div>

                  {/* Quick toggle */}
                  <div
                    className="shrink-0"
                    onClick={(e) => handleQuickToggle(e, cmd.key, cmd.enabled)}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={cmd.enabled}
                        onCheckedChange={() => {}}
                        aria-label={`Toggle ${cmd.key}`}
                      />
                    )}
                  </div>

                  {/* Arrow hint */}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/60 transition-colors" />
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
              <span className="text-foreground font-medium">Limit cost</span> — angka di sebelah toggle menunjukkan limit yang dibutuhkan. Klik command untuk mengubah pengaturan lebih lanjut.
            </p>
          </div>
          <p>Perubahan berlaku <span className="text-foreground font-medium">langsung</span> tanpa perlu restart bot.</p>
        </div>
      )}

      {/* Detail modal */}
      {selectedCmd && botId && (
        <CommandDetailModal
          cmd={selectedCmd}
          botId={botId}
          token={token}
          onClose={() => setSelectedCmd(null)}
          onUpdate={handleCommandUpdate}
        />
      )}
    </div>
  );
}
