import { useState, useEffect } from "react";
import {
  useListBots,
  useGetBot,
  getListBotsQueryKey,
  getGetBotQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bot as BotIcon, Phone, Clock, Save, Loader2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PLAN_COLOR: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  basic: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

function BotConfig({ botId }: { botId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bot, isLoading } = useGetBot(botId, {
    query: { queryKey: getGetBotQueryKey(botId) },
  });

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bot) {
      setName(bot.name);
      setPrefix(bot.prefix);
    }
  }, [bot]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !prefix.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), prefix: prefix.trim() }),
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

  if (isLoading || !bot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const plan = bot.subscription?.plan ?? "free";

  return (
    <div className="space-y-5 max-w-2xl animate-in fade-in duration-400">
      <div>
        <h1 className="text-xl font-bold text-foreground">Konfigurasi Bot</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Atur nama dan pengaturan bot kamu.</p>
      </div>

      {/* Info card */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Bot ID</p>
              <p className="text-xs font-mono text-foreground/60 truncate">{bot.id.slice(-8)}...</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Status</p>
              <p className="text-sm font-medium text-foreground capitalize">{bot.status}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Nomor WA</p>
              <p className="text-sm font-mono text-foreground">{bot.phoneNumber ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Paket</p>
              <Badge variant="outline" className={PLAN_COLOR[plan] ?? ""}>
                <Shield className="w-3 h-3 mr-1" />
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Pengaturan
          </CardTitle>
          <CardDescription className="text-xs">
            Perubahan akan langsung diterapkan pada bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="botName" className="flex items-center gap-2 text-sm font-medium">
                <BotIcon className="w-3.5 h-3.5 text-muted-foreground" />
                Nama Bot
              </Label>
              <Input
                id="botName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama bot kamu"
                className="bg-background h-10"
                required
              />
              <p className="text-xs text-muted-foreground">
                Nama yang ditampilkan di dashboard.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="botPrefix" className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono text-muted-foreground text-base leading-none">#</span>
                Prefix Perintah
              </Label>
              <div className="flex gap-3 items-start">
                <Input
                  id="botPrefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="."
                  className="bg-background font-mono h-10 w-28"
                  maxLength={3}
                  required
                />
                <div className="text-xs text-muted-foreground pt-2.5 leading-relaxed">
                  Karakter pemicu perintah.
                  <br />
                  Contoh: <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">{prefix || "."}ping</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                Nomor WhatsApp
              </Label>
              <Input
                value={bot.phoneNumber ?? "Belum terhubung"}
                readOnly
                className="bg-secondary/50 text-muted-foreground font-mono h-10 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Nomor diatur otomatis saat bot dihubungkan.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                Dibuat
              </Label>
              <Input
                value={new Date(bot.createdAt).toLocaleString("id-ID")}
                readOnly
                className="bg-secondary/50 text-muted-foreground h-10 cursor-not-allowed"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" className="gap-2 px-6" disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><Save className="w-4 h-4" /> Simpan Perubahan</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfigPage() {
  const { data: bots, isLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const bot = bots?.[0];
  if (!bot) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground text-sm">Bot tidak ditemukan.</p>
      </div>
    );
  }

  return <BotConfig botId={bot.id} />;
}
