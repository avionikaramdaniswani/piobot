import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetBot, 
  useDeleteBot, 
  useStartBot, 
  useStopBot, 
  useRequestPairing,
  getGetBotQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Terminal, Power, Square, Trash2, Smartphone, 
  KeyRound, Shield, Clock, ArrowLeft, QrCode, RefreshCw, Loader2
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";

const statusLabel: Record<string, string> = {
  connected: "Terhubung",
  connecting: "Menghubungkan",
  disconnected: "Terputus",
  inactive: "Nonaktif",
};

function useQRCode(botId: string, enabled: boolean) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setQrCode(null);
      return;
    }

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
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [botId, enabled]);

  return { qrCode, loading };
}

export default function BotDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading, error } = useGetBot(id, {
    query: { enabled: !!id, queryKey: getGetBotQueryKey(id), refetchInterval: 4000 }
  });

  const startMutation = useStartBot();
  const stopMutation = useStopBot();
  const deleteMutation = useDeleteBot();
  const pairingMutation = useRequestPairing();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  const isConnecting = bot?.status === "connecting";
  const { qrCode, loading: qrLoading } = useQRCode(id, isConnecting);

  useEffect(() => {
    if (!isConnecting) setPairingCode("");
  }, [isConnecting]);

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-destructive">Bot Tidak Ditemukan</h2>
        <Button variant="link" onClick={() => setLocation("/bots")}>Kembali ke Daftar Bot</Button>
      </div>
    );
  }

  const handleStart = async () => {
    try {
      await startMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
      toast({ title: "Bot Dinyalakan", description: "Menunggu QR code WhatsApp..." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
      toast({ title: "Bot Dimatikan", description: "Bot berhasil dihentikan." });
      setPairingCode("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Yakin ingin menghapus bot ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Bot Dihapus", description: "Bot telah berhasil dihapus." });
      setLocation("/bots");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;
    try {
      const res = await pairingMutation.mutateAsync({ id, data: { phoneNumber } });
      setPairingCode(res.code);
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
      toast({ title: "Kode Pairing Dibuat", description: "Masukkan kode ini di WhatsApp Anda." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  if (isLoading || !bot) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-64 w-full" /></div>;
  }

  const isConnected = bot.status === "connected";
  const isOffline = bot.status === "disconnected" || bot.status === "inactive";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/bots"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{bot.name}</h1>
            <Badge variant="outline" className={
              bot.status === 'connected' ? 'bg-primary/10 text-primary border-primary/20' :
              bot.status === 'connecting' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
              'bg-destructive/10 text-destructive border-destructive/20'
            }>
              <span className={`w-2 h-2 rounded-full mr-2 inline-block ${
                bot.status === 'connected' ? 'bg-primary animate-pulse' :
                bot.status === 'connecting' ? 'bg-yellow-500 animate-bounce' :
                'bg-destructive'
              }`}></span>
              {(statusLabel[bot.status] ?? bot.status).toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">ID: {bot.id}</p>
        </div>
        
        <div className="flex gap-2">
          {(isOffline || isConnecting) && (
            <Button onClick={handleStart} disabled={startMutation.isPending || isConnecting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Power className="w-4 h-4 mr-2" /> {startMutation.isPending ? "Memulai..." : "Nyalakan Bot"}
            </Button>
          )}
          {isConnected && (
            <Button onClick={handleStop} disabled={stopMutation.isPending} variant="destructive">
              <Square className="w-4 h-4 mr-2" /> {stopMutation.isPending ? "Menghentikan..." : "Matikan Bot"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" /> Konfigurasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Prefix Perintah</Label>
                <div className="font-mono text-lg font-bold bg-secondary px-3 py-1 rounded inline-block mt-1">
                  {bot.prefix}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Dibuat</Label>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {new Date(bot.createdAt).toLocaleDateString("id-ID")}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Paket Langganan</Label>
              <div className="mt-1">
                {bot.subscription ? (
                  <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 text-sm py-1 px-3">
                    <Shield className="w-4 h-4 mr-2" /> {bot.subscription.plan.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-sm py-1 px-3">Paket Gratis</Badge>
                )}
                {!bot.subscription && (
                  <Button variant="link" size="sm" asChild className="ml-2 text-primary">
                    <Link href="/subscription">Upgrade Paket</Link>
                  </Button>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-border">
               <Button variant="destructive" size="sm" onClick={handleDelete} className="w-full sm:w-auto" disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4 mr-2" /> Hapus Bot
               </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> Koneksi WhatsApp
            </CardTitle>
            <CardDescription>
              {bot.phoneNumber ? `Terhubung ke ${bot.phoneNumber}` : "Hubungkan perangkat untuk mengaktifkan bot"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
                <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground">Koneksi Aktif</h3>
                <p className="text-muted-foreground text-sm mt-1">Bot sedang menerima perintah di {bot.phoneNumber}</p>
                <Button variant="destructive" size="sm" className="mt-4" onClick={handleStop} disabled={stopMutation.isPending}>
                  <Square className="w-3 h-3 mr-2" /> Putuskan Koneksi
                </Button>
              </div>
            ) : isConnecting ? (
              <Tabs defaultValue="qr">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="qr" className="flex-1 gap-2">
                    <QrCode className="w-4 h-4" /> Scan QR Code
                  </TabsTrigger>
                  <TabsTrigger value="pairing" className="flex-1 gap-2">
                    <KeyRound className="w-4 h-4" /> Kode Pairing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-inner min-h-[216px] flex items-center justify-center">
                      {qrCode ? (
                        <QRCodeSVG
                          value={qrCode}
                          size={200}
                          bgColor="#ffffff"
                          fgColor="#111827"
                          level="M"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-gray-400">
                          <Loader2 className="w-10 h-10 animate-spin" />
                          <p className="text-sm">Membuat QR code...</p>
                        </div>
                      )}
                    </div>

                    {qrCode && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                        QR code diperbarui otomatis setiap 3 detik
                      </div>
                    )}

                    <ol className="text-xs text-muted-foreground space-y-1 text-left w-full border border-border rounded-lg p-3 bg-secondary/30">
                      <li>1. Buka WhatsApp di HP Anda</li>
                      <li>2. Ketuk <strong>Perangkat Tertaut</strong></li>
                      <li>3. Ketuk <strong>Tautkan Perangkat</strong></li>
                      <li>4. Arahkan kamera ke QR code di atas</li>
                    </ol>
                  </div>
                </TabsContent>

                <TabsContent value="pairing" className="space-y-4">
                  {!pairingCode ? (
                    <form onSubmit={handleRequestPairing} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Nomor HP Target (dengan kode negara)</Label>
                        <Input 
                          id="phone" 
                          placeholder="+6281234567890" 
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="bg-background font-mono"
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={pairingMutation.isPending}>
                        <KeyRound className="w-4 h-4 mr-2" /> 
                        {pairingMutation.isPending ? "Membuat kode..." : "Minta Kode Pairing"}
                      </Button>
                      <ol className="text-xs text-muted-foreground space-y-1 border border-border rounded-lg p-3 bg-secondary/30">
                        <li>1. Buka WhatsApp di HP Anda</li>
                        <li>2. Ketuk <strong>Perangkat Tertaut → Tautkan Perangkat</strong></li>
                        <li>3. Pilih <strong>Tautkan dengan nomor telepon</strong></li>
                        <li>4. Masukkan kode 8 digit yang muncul</li>
                      </ol>
                    </form>
                  ) : (
                    <div className="space-y-4 animate-in zoom-in duration-300">
                      <p className="text-sm text-muted-foreground text-center">
                        Masukkan kode ini di WhatsApp → Perangkat Tertaut
                      </p>
                      <div className="text-4xl font-mono tracking-[0.25em] font-bold text-primary bg-background py-4 rounded-md border border-primary/20 text-center">
                        {pairingCode}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" />
                        Menunggu konfirmasi perangkat...
                      </p>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setPairingCode("")}>
                        Ganti Nomor
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center p-6 border border-dashed border-border rounded-lg bg-card/50">
                <Power className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Bot sedang offline.</p>
                <p className="text-muted-foreground text-sm mt-1">Nyalakan bot dulu untuk memulai proses koneksi.</p>
                <Button className="mt-4" onClick={handleStart} disabled={startMutation.isPending}>
                  <Power className="w-4 h-4 mr-2" /> Nyalakan Bot
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
