import { useState } from "react";
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
import { 
  Terminal, Power, Square, Trash2, Smartphone, 
  KeyRound, Shield, Clock, ArrowLeft 
} from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabel: Record<string, string> = {
  connected: "Terhubung",
  connecting: "Menghubungkan",
  disconnected: "Terputus",
  inactive: "Nonaktif",
};

export default function BotDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading, error } = useGetBot(id, {
    query: { enabled: !!id, queryKey: getGetBotQueryKey(id), refetchInterval: 5000 }
  });

  const startMutation = useStartBot();
  const stopMutation = useStopBot();
  const deleteMutation = useDeleteBot();
  const pairingMutation = useRequestPairing();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");

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
      toast({ title: "Bot Dinyalakan", description: "Proses koneksi dimulai." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getGetBotQueryKey(id) });
      toast({ title: "Bot Dimatikan", description: "Bot berhasil dihentikan." });
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
  const isConnecting = bot.status === "connecting";
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
              </div>
            ) : isConnecting ? (
              <div className="space-y-6">
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
                  </form>
                ) : (
                  <div className="bg-secondary/50 border border-border rounded-lg p-6 text-center animate-in zoom-in duration-300">
                    <p className="text-sm text-muted-foreground mb-4">Masukkan kode ini di WhatsApp → Perangkat Tertaut</p>
                    <div className="text-4xl font-mono tracking-[0.25em] font-bold text-primary bg-background py-4 rounded-md border border-primary/20">
                      {pairingCode}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping" /> Menunggu perangkat...
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-border rounded-lg bg-card/50">
                <Power className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">Bot sedang offline. Nyalakan dulu untuk memulai pairing.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
