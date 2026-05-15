import { useState, useEffect } from "react";
import {
  useListBots,
  useCreateBot,
  useGetBot,
  useDeleteBot,
  useStartBot,
  useStopBot,
  useRequestPairing,
  getListBotsQueryKey,
  getGetBotQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "wouter";
import {
  Bot as BotIcon,
  Power,
  Square,
  Trash2,
  Smartphone,
  KeyRound,
  Shield,
  Clock,
  QrCode,
  Loader2,
  Plus,
  Terminal,
  CheckCircle2,
  Wifi,
  WifiOff,
  Zap,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  connected: "Terhubung",
  connecting: "Menghubungkan",
  disconnected: "Terputus",
  inactive: "Tidak Aktif",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  connecting: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  disconnected: "bg-red-500/10 text-red-400 border-red-500/20",
  inactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const DOT_COLOR: Record<string, string> = {
  connected: "bg-emerald-400 animate-pulse",
  connecting: "bg-yellow-400 animate-bounce",
  disconnected: "bg-red-400",
  inactive: "bg-zinc-400",
};

// ─── QR Code hook ─────────────────────────────────────────────────────────────

function useQRCode(botId: string, enabled: boolean) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) { setQrCode(null); return; }
    let cancelled = false;

    async function fetchQR() {
      setLoading(true);
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`/api/bots/${botId}/qrcode`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setQrCode(data.qrCode ?? null);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQR();
    const interval = setInterval(fetchQR, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [botId, enabled]);

  return { qrCode, loading };
}

// ─── Onboarding: no bot yet ────────────────────────────────────────────────────

function CreateBotOnboarding() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateBot();

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState(".");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ data: { name, prefix } });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      toast({ title: "Bot berhasil dibuat!", description: `${name} siap untuk dihubungkan.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message || "Tidak dapat membuat bot." });
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <BotIcon className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Bot WhatsApp Anda</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Satu langkah untuk memulai — beri nama bot Anda dan pilih prefix perintah.
          </p>
        </div>

        <Card className="border-border bg-card shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="botName" className="text-sm font-medium">Nama Bot</Label>
                <Input
                  id="botName"
                  placeholder="contoh: SalesBot, CustomerBot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-background h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="botPrefix" className="text-sm font-medium">
                  Prefix Perintah
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    karakter pemicu perintah (mis: <span className="font-mono">.ping</span>)
                  </span>
                </Label>
                <Input
                  id="botPrefix"
                  placeholder="."
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="bg-background font-mono h-11 w-24"
                  maxLength={3}
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 gap-2"
                disabled={createMutation.isPending || !name.trim()}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Membuat Bot...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Buat Bot Sekarang</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Connection panel ─────────────────────────────────────────────────────────

function ConnectionPanel({ botId, status, phoneNumber, onStart, onStop, startPending, stopPending }: {
  botId: string;
  status: string;
  phoneNumber: string | null;
  onStart: () => void;
  onStop: () => void;
  startPending: boolean;
  stopPending: boolean;
}) {
  const { toast } = useToast();
  const pairingMutation = useRequestPairing();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const isOffline = status === "disconnected" || status === "inactive";

  const { qrCode } = useQRCode(botId, isConnecting);

  useEffect(() => { if (!isConnecting) setPairingCode(""); }, [isConnecting]);

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await pairingMutation.mutateAsync({ id: botId, data: { phoneNumber: phone } });
      setPairingCode(res.code);
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(botId) });
      toast({ title: "Kode Pairing Dibuat", description: "Masukkan kode ini di WhatsApp Anda." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  if (isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Koneksi Aktif</p>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bot menerima perintah di <span className="font-mono text-foreground">{phoneNumber}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onStop} disabled={stopPending}>
          <Square className="w-3.5 h-3.5" />
          {stopPending ? "Memutuskan..." : "Putuskan Koneksi"}
        </Button>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
          <WifiOff className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">Bot Tidak Aktif</p>
          <p className="text-muted-foreground text-sm mt-1">
            Nyalakan bot untuk memulai proses penghubungan ke WhatsApp.
          </p>
        </div>
        <Button className="gap-2 px-6" onClick={onStart} disabled={startPending}>
          <Power className="w-4 h-4" />
          {startPending ? "Memulai..." : "Nyalakan Bot"}
        </Button>
      </div>
    );
  }

  return (
    <Tabs defaultValue="qr" className="w-full">
      <TabsList className="w-full mb-4 bg-secondary">
        <TabsTrigger value="qr" className="flex-1 gap-2 text-xs">
          <QrCode className="w-3.5 h-3.5" /> Scan QR Code
        </TabsTrigger>
        <TabsTrigger value="pairing" className="flex-1 gap-2 text-xs">
          <KeyRound className="w-3.5 h-3.5" /> Kode Pairing
        </TabsTrigger>
      </TabsList>

      <TabsContent value="qr">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-3 rounded-xl shadow-inner min-h-[200px] flex items-center justify-center">
            {qrCode ? (
              <QRCodeSVG value={qrCode} size={176} bgColor="#ffffff" fgColor="#111827" level="M" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-400 px-8">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-xs text-center">Membuat QR code...</p>
              </div>
            )}
          </div>
          {qrCode && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
              Diperbarui otomatis tiap 3 detik
            </p>
          )}
          <ol className="text-xs text-muted-foreground space-y-1 text-left w-full border border-border rounded-lg p-3 bg-secondary/30">
            <li>1. Buka WhatsApp di HP Anda</li>
            <li>2. Ketuk <strong>Perangkat Tertaut</strong></li>
            <li>3. Ketuk <strong>Tautkan Perangkat</strong></li>
            <li>4. Arahkan kamera ke QR code di atas</li>
          </ol>
        </div>
      </TabsContent>

      <TabsContent value="pairing">
        {!pairingCode ? (
          <form onSubmit={handlePairing} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pairingPhone" className="text-sm">Nomor WhatsApp Target</Label>
              <Input
                id="pairingPhone"
                placeholder="+6281234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-background font-mono"
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={pairingMutation.isPending}>
              <KeyRound className="w-4 h-4" />
              {pairingMutation.isPending ? "Membuat kode..." : "Minta Kode Pairing"}
            </Button>
            <ol className="text-xs text-muted-foreground space-y-1 border border-border rounded-lg p-3 bg-secondary/30">
              <li>1. Buka WhatsApp → Perangkat Tertaut</li>
              <li>2. Pilih <strong>Tautkan dengan nomor telepon</strong></li>
              <li>3. Masukkan kode 8 digit yang muncul</li>
            </ol>
          </form>
        ) : (
          <div className="space-y-4 animate-in zoom-in duration-300 text-center">
            <p className="text-sm text-muted-foreground">Masukkan kode ini di WhatsApp → Perangkat Tertaut</p>
            <div className="text-4xl font-mono tracking-[0.3em] font-bold text-primary bg-primary/5 py-5 rounded-xl border border-primary/20">
              {pairingCode}
            </div>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
              Menunggu konfirmasi perangkat...
            </p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPairingCode("")}>
              Ganti Nomor
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

// ─── Bot management view ──────────────────────────────────────────────────────

function BotManagement({ botId }: { botId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { queryKey: getGetBotQueryKey(botId), refetchInterval: 4000 },
  });

  const startMutation = useStartBot();
  const stopMutation = useStopBot();
  const deleteMutation = useDeleteBot();

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
      toast({ title: "Bot dimatikan", description: "Bot berhasil dihentikan." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus bot ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      await deleteMutation.mutateAsync({ id: botId });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      toast({ title: "Bot dihapus", description: "Bot berhasil dihapus. Anda bisa membuat bot baru." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  if (isLoading || !bot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isConnected = bot.status === "connected";
  const isConnecting = bot.status === "connecting";
  const isOffline = bot.status === "disconnected" || bot.status === "inactive";

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        <div className={cn(
          "h-1 w-full",
          isConnected ? "bg-emerald-500" : isConnecting ? "bg-yellow-400" : "bg-zinc-600"
        )} />
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <BotIcon className="w-6 h-6 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground truncate">{bot.name}</h1>
                <Badge variant="outline" className={cn("text-xs gap-1.5", STATUS_COLOR[bot.status] ?? "")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", DOT_COLOR[bot.status] ?? "bg-zinc-400")} />
                  {STATUS_LABEL[bot.status] ?? bot.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {bot.phoneNumber ?? "Nomor belum terhubung"}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              {isOffline && (
                <Button onClick={handleStart} disabled={startMutation.isPending} className="gap-2 h-9">
                  <Power className="w-3.5 h-3.5" />
                  {startMutation.isPending ? "Memulai..." : "Nyalakan"}
                </Button>
              )}
              {isConnecting && (
                <Button onClick={handleStop} variant="outline" disabled={stopMutation.isPending} className="gap-2 h-9">
                  <Square className="w-3.5 h-3.5" />
                  Batalkan
                </Button>
              )}
              {isConnected && (
                <Button onClick={handleStop} variant="destructive" disabled={stopMutation.isPending} className="gap-2 h-9">
                  <Square className="w-3.5 h-3.5" />
                  {stopMutation.isPending ? "Menghentikan..." : "Matikan"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Two-column section ────────────────────────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2">

        {/* Connection card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              Koneksi WhatsApp
            </CardTitle>
            <CardDescription className="text-xs">
              {isConnected
                ? `Aktif di ${bot.phoneNumber}`
                : isConnecting
                ? "Scan QR atau gunakan kode pairing"
                : "Bot offline — nyalakan untuk menghubungkan"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectionPanel
              botId={botId}
              status={bot.status}
              phoneNumber={bot.phoneNumber ?? null}
              onStart={handleStart}
              onStop={handleStop}
              startPending={startMutation.isPending}
              stopPending={stopMutation.isPending}
            />
          </CardContent>
        </Card>

        {/* Config card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Konfigurasi Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Prefix</p>
                <div className="font-mono text-lg font-bold bg-secondary px-3 py-1.5 rounded-lg inline-block">
                  {bot.prefix}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Dibuat</p>
                <div className="flex items-center gap-1.5 text-sm text-foreground mt-1">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {new Date(bot.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Paket Langganan</p>
              <div className="flex items-center justify-between mt-2">
                {bot.subscription ? (
                  <Badge className="bg-primary/15 text-primary border border-primary/20 hover:bg-primary/20 gap-1.5 px-3 py-1">
                    <Shield className="w-3 h-3" />
                    {bot.subscription.plan.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1">
                    <Zap className="w-3 h-3" />
                    Gratis
                  </Badge>
                )}
                <Button variant="ghost" size="sm" asChild className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <Link href="/subscription">
                    <CreditCard className="w-3.5 h-3.5" /> Upgrade
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </Button>
              </div>
            </div>

            {bot.subscription?.features && bot.subscription.features.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Fitur Aktif</p>
                <div className="flex flex-wrap gap-1.5">
                  {bot.subscription.features.map((f: string) => (
                    <span key={f} className="text-xs bg-secondary text-foreground px-2 py-0.5 rounded font-mono">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-3">
                ID: <span className="font-mono opacity-60">{bot.id}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 w-full justify-start"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteMutation.isPending ? "Menghapus..." : "Hapus Bot"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
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
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const bot = bots?.[0];

  if (!bot) return <CreateBotOnboarding />;

  return <BotManagement botId={bot.id} />;
}
