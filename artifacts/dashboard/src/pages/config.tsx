import { useState, useEffect, useRef } from "react";
import {
  useListBots,
  useGetBot,
  getListBotsQueryKey,
  getGetBotQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Bot as BotIcon,
  Phone,
  Clock,
  Save,
  Loader2,
  Shield,
  UserPlus,
  X,
  Hash,
  Plus,
  Wifi,
  WifiOff,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_COLOR: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  basic: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

const STATUS_MAP: Record<string, { label: string; color: string; Icon: any }> = {
  connected: { label: "Terhubung", color: "text-green-500", Icon: Wifi },
  connecting: { label: "Menghubungkan", color: "text-yellow-500", Icon: Loader2 },
  disconnected: { label: "Terputus", color: "text-red-500", Icon: WifiOff },
  inactive: { label: "Tidak Aktif", color: "text-zinc-400", Icon: WifiOff },
};

interface OwnerEntry {
  name: string;
  phoneNumber: string;
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-border/60 flex items-start gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        )}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function BotConfig({ botId }: { botId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { queryKey: getGetBotQueryKey(botId) },
  });

  const [name, setName] = useState("");
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [newPrefix, setNewPrefix] = useState("");
  const [owners, setOwners] = useState<OwnerEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      const botAny = bot as any;
      setPrefixes(
        Array.isArray(botAny.prefixes) && botAny.prefixes.length > 0
          ? botAny.prefixes
          : [bot.prefix]
      );
      setOwners(
        Array.isArray(botAny.owners) ? botAny.owners : []
      );
    }
  }, [bot]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (prefixes.length === 0) {
      toast({ variant: "destructive", title: "Prefix wajib diisi", description: "Tambahkan minimal 1 prefix perintah." });
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          prefixes,
          owners,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menyimpan");
      }
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      toast({ title: "Konfigurasi disimpan", description: "Perubahan bot berhasil diterapkan." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addPrefix = () => {
    const val = newPrefix.trim();
    if (!val || prefixes.includes(val) || prefixes.length >= 5) return;
    setPrefixes((p) => [...p, val]);
    setNewPrefix("");
  };

  const removePrefix = (idx: number) => {
    setPrefixes((p) => p.filter((_, i) => i !== idx));
  };

  const addOwner = () => {
    if (owners.length >= 3) return;
    setOwners((o) => [...o, { name: "", phoneNumber: "" }]);
  };

  const removeOwner = (idx: number) => {
    setOwners((o) => o.filter((_, i) => i !== idx));
  };

  const updateOwner = (idx: number, field: keyof OwnerEntry, value: string) => {
    setOwners((o) => o.map((entry, i) => (i === idx ? { ...entry, [field]: value } : entry)));
  };

  if (isLoading || !bot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const plan = (bot as any).subscription?.plan ?? "free";
  const status = STATUS_MAP[bot.status] ?? STATUS_MAP.inactive;
  const StatusIcon = status.Icon;

  return (
    <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-5 pb-24 animate-in fade-in duration-300">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Konfigurasi Bot</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Atur nama dan pengaturan bot kamu.</p>
      </div>

      {/* Status bar */}
      <div className="rounded-xl border border-border bg-card px-6 py-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Bot ID</p>
            <p className="text-xs font-mono text-foreground/50 truncate">{bot.id.slice(-10)}...</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Status</p>
            <div className={cn("flex items-center gap-1.5 text-sm font-medium", status.color)}>
              <StatusIcon className={cn("w-3.5 h-3.5", bot.status === "connecting" && "animate-spin")} />
              {status.label}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Nomor WA</p>
            <p className="text-sm font-mono text-foreground">{bot.phoneNumber ?? "—"}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Paket</p>
            <Badge variant="outline" className={cn("gap-1 text-xs", PLAN_COLOR[plan] ?? "")}>
              <Shield className="w-3 h-3" />
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Nama Bot */}
      <SectionCard title="Nama Bot" description="Nama yang ditampilkan di dashboard." icon={BotIcon}>
        <div className="space-y-2 max-w-lg">
          <Label htmlFor="botName" className="text-xs font-medium text-muted-foreground">
            Nama Bot <span className="text-destructive">*</span>
          </Label>
          <Input
            id="botName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama bot kamu"
            className="bg-background h-10"
            required
          />
        </div>
      </SectionCard>

      {/* Owner Bot */}
      <SectionCard
        title="Owner Bot"
        description="Nomor yang punya akses penuh ke bot (bypass limit, perintah owner-only)."
        icon={UserPlus}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className={cn("font-semibold", owners.length >= 3 ? "text-orange-500" : "text-foreground")}>
                {owners.length}
              </span>
              /3 terpakai
            </p>
            <button
              type="button"
              onClick={addOwner}
              disabled={owners.length >= 3}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                owners.length >= 3
                  ? "border-border text-muted-foreground/40 cursor-not-allowed"
                  : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Owner
            </button>
          </div>

          {owners.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-secondary/20 py-8 text-center">
              <p className="text-xs text-muted-foreground">Belum ada owner. Klik "+ Tambah Owner" untuk menambahkan.</p>
            </div>
          )}

          {owners.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Nama</p>
                <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Nomor (62xxx)</p>
                <div className="w-8" />
              </div>
              {owners.map((owner, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
                  <Input
                    value={owner.name}
                    onChange={(e) => updateOwner(idx, "name", e.target.value)}
                    placeholder="Nama owner"
                    className="bg-background h-9 text-sm"
                  />
                  <Input
                    value={owner.phoneNumber}
                    onChange={(e) => updateOwner(idx, "phoneNumber", e.target.value)}
                    placeholder="628xxxxxxxxxx"
                    className="bg-background h-9 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeOwner(idx)}
                    className="w-8 h-8 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/15 flex items-center justify-center transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Prefix */}
      <SectionCard
        title="Prefix Perintah"
        description="Karakter di depan command supaya bot tahu user lagi manggil bot."
        icon={Hash}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <span className={cn("font-semibold", prefixes.length >= 5 ? "text-orange-500" : "text-foreground")}>
                {prefixes.length}
              </span>
              /5 prefix aktif
            </p>
          </div>

          {/* Active prefixes */}
          {prefixes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prefixes.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-secondary border border-border rounded-lg px-3 py-1.5"
                >
                  <span className="font-mono text-sm font-semibold text-foreground">{p}</span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    {p}ping
                  </span>
                  {prefixes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePrefix(idx)}
                      className="ml-1 w-4 h-4 rounded text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add prefix */}
          {prefixes.length < 5 && (
            <div className="flex gap-2 max-w-xs">
              <Input
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addPrefix(); }
                }}
                placeholder="+ prefix baru"
                maxLength={5}
                className="bg-background h-9 font-mono text-sm w-28"
              />
              <button
                type="button"
                onClick={addPrefix}
                disabled={!newPrefix.trim() || prefixes.includes(newPrefix.trim())}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all h-9",
                  !newPrefix.trim() || prefixes.includes(newPrefix.trim())
                    ? "border-border text-muted-foreground/40 cursor-not-allowed"
                    : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Karakter prefix tidak boleh lebih dari 5 karakter. Pisahkan dengan menambah prefix baru.
          </p>
        </div>
      </SectionCard>

      {/* Info readonly */}
      <SectionCard title="Informasi Bot" icon={Clock}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" /> Nomor WhatsApp
            </Label>
            <Input
              value={bot.phoneNumber ?? "Belum terhubung"}
              readOnly
              className="bg-secondary/40 text-muted-foreground font-mono h-9 cursor-not-allowed text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Diatur otomatis saat bot dihubungkan.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Dibuat
            </Label>
            <Input
              value={new Date(bot.createdAt).toLocaleString("id-ID")}
              readOnly
              className="bg-secondary/40 text-muted-foreground h-9 cursor-not-allowed text-sm"
            />
          </div>
        </div>
      </SectionCard>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-56 right-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground hidden sm:block">
          * Perubahan berlaku segera setelah disimpan.
        </p>
        <button
          type="submit"
          disabled={saving}
          className={cn(
            "ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm",
            saving
              ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
          )}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
          ) : (
            <><Save className="w-4 h-4" /> Simpan Config</>
          )}
        </button>
      </div>
    </form>
  );
}

export default function ConfigPage() {
  const { data: bots, isLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  const bot = Array.isArray(bots) ? bots[0] : (bots as any)?.[0];
  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground text-sm">Bot tidak ditemukan.</p>
      </div>
    );
  }

  return <BotConfig botId={bot.id} />;
}
