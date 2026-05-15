import { useGetBotStats, useListBots, getGetBotStatsQueryKey, getListBotsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Bot as BotIcon, Zap } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetBotStats({
    query: { queryKey: getGetBotStatsQueryKey() }
  });

  const { data: bots, isLoading: botsLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() }
  });

  const StatCard = ({ title, value, icon: Icon, colorClass, loading }: any) => (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-3xl font-bold ${colorClass}`}>{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );

  const statusLabel: Record<string, string> = {
    connected: "Terhubung",
    connecting: "Menghubungkan",
    disconnected: "Terputus",
    inactive: "Tidak Aktif",
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="w-8 h-8 text-primary" />
          Ringkasan Jaringan
        </h1>
        <p className="text-muted-foreground mt-2">Status real-time jaringan bot Anda.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Bot" value={stats?.total} icon={BotIcon} colorClass="text-foreground" loading={statsLoading} />
        <StatCard title="Terhubung & Aktif" value={stats?.connected} icon={CheckCircle2} colorClass="text-primary" loading={statsLoading} />
        <StatCard title="Sedang Terhubung" value={stats?.connecting} icon={Zap} colorClass="text-yellow-500" loading={statsLoading} />
        <StatCard title="Terputus / Nonaktif" value={(stats?.disconnected || 0) + (stats?.inactive || 0)} icon={XCircle} colorClass="text-destructive" loading={statsLoading} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Bot Terbaru</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/bots">Lihat Semua</Link>
          </Button>
        </div>

        {botsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : !bots?.length ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card/50">
            <BotIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">Belum ada bot</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Buat bot pertama Anda untuk memulai.</p>
            <Button asChild>
              <Link href="/bots">Buat Bot</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bots.slice(0, 6).map((bot) => (
              <Link key={bot.id} href={`/bots/${bot.id}`}>
                <Card className="hover:bg-secondary/50 transition-colors cursor-pointer border-border group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">{bot.name}</CardTitle>
                      <Badge variant="outline" className={
                        bot.status === 'connected' ? 'bg-primary/10 text-primary border-primary/20' :
                        bot.status === 'connecting' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-destructive/10 text-destructive border-destructive/20'
                      }>
                        {statusLabel[bot.status] ?? bot.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground font-mono truncate">
                      {bot.phoneNumber || "Nomor belum diatur"}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Prefix: <span className="text-foreground font-mono bg-secondary px-1 py-0.5 rounded">{bot.prefix || '!'}</span></span>
                      {bot.subscription && (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          {bot.subscription.plan}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
