import { useState, useEffect, useRef } from "react";
import {
  useListBots,
  useGetBot,
  useStartBot,
  useStopBot,
  useRequestPairing,
  getListBotsQueryKey,
  getGetBotQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  Calendar,
  Clock,
  Star,
  QrCode,
  KeyRound,
  Loader2,
  Power,
  Square,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  connected: "online",
  connecting: "connecting",
  disconnected: "offline",
  inactive: "offline",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRuntime(ms: number) {
  const h = Math.floor(ms / 3600000).toString().padStart(2, "0");
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, "0");
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── QR hook ─────────────────────────────────────────────────────────────────

function useQRCode(botId: string, enabled: boolean) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) { setQrCode(null); return; }
    let cancelled = false;
    async function fetch_() {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/bots/${botId}/qrcode`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setQrCode(data.qrCode ?? null);
    }
    fetch_();
    const id = setInterval(fetch_, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [botId, enabled]);
  return qrCode;
}

// ─── Terminal component ───────────────────────────────────────────────────────

interface LogLine {
  time: string;
  text: string;
  type: "info" | "success" | "error" | "warn" | "muted";
}

function tsToTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function BotTerminal({ botId, status, username }: {
  botId: string;
  status: string;
  username: string;
}) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [streamOk, setStreamOk] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Connect to SSE log stream
  useEffect(() => {
    const token = localStorage.getItem("accessToken") ?? "";
    const url = `/api/bots/${botId}/logs?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onopen = () => setStreamOk(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          message: string;
          level: LogLine["type"];
          timestamp: string;
        };
        setLogs((prev) => [
          ...prev.slice(-199),
          { time: tsToTime(data.timestamp), text: data.message, type: data.level ?? "info" },
        ]);
      } catch {}
    };
    es.onerror = () => setStreamOk(false);

    return () => es.close();
  }, [botId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const connIndicator =
    status === "connected"   ? { dot: "bg-[#3fb950]",              label: "connected"    } :
    status === "connecting"  ? { dot: "bg-yellow-400 animate-pulse", label: "connecting" } :
                               { dot: "bg-zinc-600",                label: "offline"      };

  const streamIndicator = streamOk
    ? { dot: "bg-[#3fb950]",            label: "live"          }
    : { dot: "bg-zinc-600 animate-pulse", label: "connecting..." };

  return (
    <div className="rounded-xl overflow-hidden border border-[#30363d] flex flex-col h-full">
      {/* Title bar */}
      <div className="flex items-center px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
        <div className="flex gap-1.5 mr-4">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[#8b949e] text-xs flex-1 text-center font-mono">
          {username}@bot — logs
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-[#8b949e] font-mono">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", connIndicator.dot)} />
            {connIndicator.label}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#8b949e] font-mono border-l border-[#30363d] pl-3">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", streamIndicator.dot)} />
            {streamIndicator.label}
          </span>
          <button
            onClick={() => setLogs([])}
            className="text-[#8b949e] text-xs hover:text-[#e6edf3] transition-colors font-mono border-l border-[#30363d] pl-3"
          >
            clear
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="bg-[#0d1117] flex-1 p-4 overflow-y-auto font-mono text-sm min-h-[240px] max-h-[320px]">
        {logs.length === 0 ? (
          <div className="flex gap-2 leading-6 text-[#484f58]">
            <span className="select-none">$</span>
            <span>menunggu log dari bot...</span>
          </div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-2 leading-6">
              <span className="text-[#3fb950] shrink-0 select-none">$</span>
              <span className="text-[#484f58] shrink-0 text-[11px] self-center tabular-nums select-none">
                [{l.time}]
              </span>
              <span className={cn(
                "break-all",
                l.type === "success" && "text-[#3fb950]",
                l.type === "error"   && "text-[#f85149]",
                l.type === "warn"    && "text-yellow-400",
                l.type === "muted"   && "text-[#484f58]",
                l.type === "info"    && "text-[#e6edf3]",
              )}>
                {l.text}
              </span>
            </div>
          ))
        )}
        <div className="flex gap-2 leading-6 mt-0.5">
          <span className="text-[#3fb950] select-none">$</span>
          <span className="text-[#e6edf3] animate-pulse select-none">▋</span>
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Bot control panel ────────────────────────────────────────────────────────

function BotControl({ botId, status, phoneNumber, onStart, onStop, onClearSession, startPending, stopPending, clearPending }: {
  botId: string;
  status: string;
  phoneNumber: string | null;
  onStart: () => void;
  onStop: () => void;
  onClearSession: () => void;
  startPending: boolean;
  stopPending: boolean;
  clearPending: boolean;
}) {
  const { toast } = useToast();
  const pairingMutation = useRequestPairing();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isOffline = !isConnecting && !isConnected;
  const qrCode = useQRCode(botId, isConnecting);

  useEffect(() => { if (!isConnecting) setPairingCode(""); }, [isConnecting]);

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await pairingMutation.mutateAsync({ id: botId, data: { phoneNumber: phone } });
      setPairingCode(res.code);
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-3 pt-5 px-5">
        <CardTitle className="text-base font-semibold">Kontrol Bot</CardTitle>
        <p className="text-xs text-muted-foreground">
          {isConnected
            ? `Terhubung ke ${phoneNumber}`
            : isConnecting
            ? "Sambungkan WhatsApp kamu"
            : "Sambungkan WhatsApp kamu"}
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        {/* Connection area */}
        <div className="min-h-[140px] flex flex-col items-center justify-center">
          {isConnected ? (
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-foreground">Bot Aktif</p>
              <p className="text-xs text-muted-foreground font-mono">{phoneNumber}</p>
            </div>
          ) : isConnecting ? (
            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="w-full bg-secondary mb-3">
                <TabsTrigger value="qr" className="flex-1 text-xs gap-1.5">
                  <QrCode className="w-3 h-3" /> QR Code
                </TabsTrigger>
                <TabsTrigger value="pairing" className="flex-1 text-xs gap-1.5">
                  <KeyRound className="w-3 h-3" /> Pairing
                </TabsTrigger>
              </TabsList>
              <TabsContent value="qr">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-2.5 rounded-lg min-h-[160px] flex items-center justify-center w-full">
                    {qrCode ? (
                      <QRCodeSVG value={qrCode} size={150} bgColor="#ffffff" fgColor="#111827" level="M" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400 py-6">
                        <Loader2 className="w-7 h-7 animate-spin" />
                        <p className="text-xs">Membuat QR code...</p>
                      </div>
                    )}
                  </div>
                  {qrCode && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping shrink-0" />
                      Diperbarui tiap 3 detik
                    </p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="pairing">
                {!pairingCode ? (
                  <form onSubmit={handlePairing} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nomor WhatsApp</Label>
                      <Input placeholder="+6281234..." value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-background font-mono text-sm h-9" required />
                    </div>
                    <Button type="submit" size="sm" className="w-full" disabled={pairingMutation.isPending}>
                      {pairingMutation.isPending ? "Membuat..." : "Minta Kode"}
                    </Button>
                  </form>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="text-3xl font-mono tracking-[0.3em] font-bold text-primary bg-primary/5 py-4 rounded-lg border border-primary/20">
                      {pairingCode}
                    </div>
                    <p className="text-xs text-muted-foreground">Masukkan di WhatsApp → Perangkat Tertaut</p>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setPairingCode("")}>Ganti Nomor</Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center space-y-2 py-4">
              <p className="text-sm text-muted-foreground">Menunggu QR atau status dari bot...</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
            onClick={onStart}
            disabled={startPending || isConnecting || isConnected}
          >
            <Power className="w-3.5 h-3.5" />
            {startPending ? "..." : "Start"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 gap-1.5 text-xs"
            onClick={onStop}
            disabled={stopPending || isOffline}
          >
            <Square className="w-3.5 h-3.5" />
            {stopPending ? "..." : "Stop"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5 text-xs"
            onClick={onClearSession}
            disabled={clearPending}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearPending ? "..." : "Hapus Sesi"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, iconBg, iconColor }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
        </div>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function BotDashboard({ botId }: { botId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: bot, isLoading } = useGetBot(botId, {
    query: { queryKey: getGetBotQueryKey(botId), refetchInterval: 4000 },
  });
  const startMutation = useStartBot();
  const stopMutation = useStopBot();
  const [clearPending, setClearPending] = useState(false);

  // Runtime counter — driven by server-side connectedAt timestamp
  const [runtime, setRuntime] = useState("—");

  useEffect(() => {
    const connectedAt = (bot as any)?.connectedAt;
    if (!connectedAt || bot?.status !== "connected") {
      setRuntime("—");
      return;
    }
    const epoch = new Date(connectedAt).getTime();
    const update = () => setRuntime(formatRuntime(Date.now() - epoch));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [(bot as any)?.connectedAt, bot?.status]);

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync({ id: botId });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
      toast({ title: "Bot dinyalakan", description: "Menunggu QR code WhatsApp..." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync({ id: botId });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
      toast({ title: "Bot dimatikan" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleClearSession = async () => {
    if (!confirm("Hapus sesi WhatsApp? Bot perlu dihubungkan ulang.")) return;
    setClearPending(true);
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/bots/${botId}/session`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
      toast({ title: "Sesi dihapus", description: "Bot perlu dihubungkan ulang ke WhatsApp." });
    } catch {
      toast({ variant: "destructive", title: "Gagal menghapus sesi" });
    } finally {
      setClearPending(false);
    }
  };

  if (isLoading || !bot) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const plan = bot.subscription?.plan ?? "free";
  const expiryDate = bot.subscription?.endDate ? formatDate(bot.subscription.endDate) : "—";
  const statusDisplay = STATUS_LABEL[bot.status] ?? bot.status;
  const isOnline = bot.status === "connected";

  return (
    <div className="space-y-5 animate-in fade-in duration-400">

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Status"
          value={isOnline ? "Online" : statusDisplay.charAt(0).toUpperCase() + statusDisplay.slice(1)}
          icon={Activity}
          iconBg={isOnline ? "bg-blue-500/10" : "bg-zinc-500/10"}
          iconColor={isOnline ? "text-blue-400" : "text-zinc-400"}
        />
        <StatCard
          label="Kedaluwarsa"
          value={expiryDate}
          icon={Calendar}
          iconBg="bg-red-500/10"
          iconColor="text-red-400"
        />
        <StatCard
          label="Runtime"
          value={runtime}
          icon={Clock}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-400"
        />
        <StatCard
          label="Role"
          value={plan.charAt(0).toUpperCase() + plan.slice(1)}
          icon={Star}
          iconBg="bg-yellow-500/10"
          iconColor="text-yellow-400"
        />
      </div>

      {/* ── Terminal + Control ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <BotTerminal
          botId={botId}
          status={bot.status}
          username={bot.name}
        />
        <BotControl
          botId={botId}
          status={bot.status}
          phoneNumber={bot.phoneNumber ?? null}
          onStart={handleStart}
          onStop={handleStop}
          onClearSession={handleClearSession}
          startPending={startMutation.isPending}
          stopPending={stopMutation.isPending}
          clearPending={clearPending}
        />
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base font-semibold">FAQ</CardTitle>
          <p className="text-xs text-muted-foreground">Pertanyaan yang sering ditanyakan</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <Accordion type="single" collapsible className="space-y-1">
            <AccordionItem value="q1" className="border-border">
              <AccordionTrigger className="text-sm hover:no-underline py-3">
                Bagaimana cara menghubungkan WhatsApp ke bot?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                Klik tombol <strong>Start</strong> lalu scan QR code menggunakan WhatsApp → Perangkat Tertaut → Tautkan Perangkat. Atau gunakan metode Pairing Code.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2" className="border-border">
              <AccordionTrigger className="text-sm hover:no-underline py-3">
                Apa itu Hapus Sesi?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                Hapus Sesi akan memutuskan koneksi WhatsApp saat ini dan menghapus data sesi tersimpan. Kamu perlu scan QR atau pairing ulang setelah ini.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3" className="border-border">
              <AccordionTrigger className="text-sm hover:no-underline py-3">
                Bot terputus terus, apa yang harus dilakukan?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                Coba Hapus Sesi lalu hubungkan ulang. Pastikan nomor WhatsApp yang digunakan tidak aktif di perangkat lain secara bersamaan.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4" className="border-border">
              <AccordionTrigger className="text-sm hover:no-underline py-3">
                Bagaimana cara mengubah prefix perintah?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground pb-3">
                Buka halaman <strong>Config</strong> di menu sidebar, lalu ubah prefix sesuai keinginan dan simpan.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page root ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: bots, isLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const bot = bots?.[0];
  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Bot belum ditemukan.</p>
          <p className="text-xs text-muted-foreground/60">Silakan hubungi admin jika terjadi masalah.</p>
        </div>
      </div>
    );
  }

  return <BotDashboard botId={bot.id} />;
}
