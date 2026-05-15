import { useListPlans, useListBots, useActivateSubscription, getListPlansQueryKey, getListBotsQueryKey, getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Zap, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PLAN_NAMES: Record<string, string> = {
  free: "Gratis",
  basic: "Basic",
  premium: "Premium",
};

export default function Subscription() {
  const { data: plans, isLoading: plansLoading } = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const { data: bots, isLoading: botsLoading } = useListBots({ query: { queryKey: getListBotsQueryKey() } });
  const activateMutation = useActivateSubscription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const bot = bots?.[0];
  const currentPlan = bot?.subscription?.plan ?? "free";

  const handleActivate = async (planType: "free" | "basic" | "premium") => {
    if (!bot) {
      toast({ variant: "destructive", title: "Bot tidak ditemukan" });
      return;
    }
    try {
      await activateMutation.mutateAsync({ data: { botId: bot.id, plan: planType, durationDays: 30 } });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSubscriptionStatusQueryKey(bot.id) });
      toast({ title: "Paket Diaktifkan", description: `Paket ${PLAN_NAMES[planType] ?? planType} berhasil diterapkan.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message || "Tidak dapat mengaktifkan paket." });
    }
  };

  const isLoading = plansLoading || botsLoading;

  return (
    <div className="space-y-8 animate-in fade-in duration-400">
      <div>
        <h1 className="text-xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pilih paket yang sesuai untuk bot kamu.</p>
      </div>

      {/* Current plan banner */}
      {bot && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Paket aktif bot <strong>{bot.name}</strong></p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bot.subscription?.endDate
                ? `Berlaku hingga ${new Date(bot.subscription.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                : "Tidak ada langganan aktif"}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 capitalize font-semibold">
            {PLAN_NAMES[currentPlan] ?? currentPlan}
          </Badge>
        </div>
      )}

      {/* Plan cards */}
      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[380px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5 items-end">
          {plans?.map((plan) => {
            const key = plan.name.toLowerCase();
            const isPremium = key === "premium";
            const isCurrent = key === currentPlan;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col border-border bg-card transition-all duration-300 hover:-translate-y-1",
                  isPremium && "border-primary shadow-lg shadow-primary/10 md:-translate-y-3",
                )}
              >
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Direkomendasikan
                  </div>
                )}

                <CardHeader className="text-center pt-8 pb-2">
                  <div className={cn(
                    "w-11 h-11 rounded-xl mx-auto mb-3 flex items-center justify-center",
                    key === "free" ? "bg-zinc-500/10" : key === "basic" ? "bg-blue-500/10" : "bg-yellow-500/10"
                  )}>
                    {key === "premium" ? (
                      <Zap className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Shield className={cn("w-5 h-5", key === "free" ? "text-zinc-400" : "text-blue-400")} />
                    )}
                  </div>
                  <CardTitle className={cn("text-xl font-bold", isPremium ? "text-primary" : "text-foreground")}>
                    {PLAN_NAMES[key] ?? plan.name}
                  </CardTitle>
                  <CardDescription className="flex items-baseline justify-center gap-1 mt-3">
                    <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground text-sm">/bln</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pt-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pb-7 pt-5">
                  <Button
                    className="w-full font-semibold"
                    variant={isPremium ? "default" : "outline"}
                    onClick={() => handleActivate(key as "free" | "basic" | "premium")}
                    disabled={activateMutation.isPending || isCurrent}
                  >
                    {isCurrent ? (
                      "Paket Aktif"
                    ) : isPremium ? (
                      <><CreditCard className="w-4 h-4 mr-2" /> Pilih {PLAN_NAMES[key] ?? plan.name}</>
                    ) : (
                      `Pilih ${PLAN_NAMES[key] ?? plan.name}`
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
