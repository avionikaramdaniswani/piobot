import { useState } from "react";
import { 
  useListPlans, 
  useListBots, 
  useActivateSubscription,
  getListPlansQueryKey,
  getListBotsQueryKey,
  getGetSubscriptionStatusQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, ShieldAlert, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Subscription() {
  const { data: plans, isLoading: plansLoading } = useListPlans({
    query: { queryKey: getListPlansQueryKey() }
  });
  
  const { data: bots, isLoading: botsLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() }
  });

  const activateMutation = useActivateSubscription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedBotId, setSelectedBotId] = useState<string>("");

  const handleActivate = async (planType: "free" | "basic" | "premium") => {
    if (!selectedBotId) {
      toast({ variant: "destructive", title: "Action Required", description: "Select a bot instance first." });
      return;
    }

    try {
      await activateMutation.mutateAsync({
        data: { botId: selectedBotId, plan: planType, durationDays: 30 }
      });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSubscriptionStatusQueryKey(selectedBotId) });
      toast({ title: "Plan Activated", description: `${planType.toUpperCase()} plan applied successfully.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not activate plan." });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center justify-center gap-3">
          <Zap className="w-10 h-10 text-primary" />
          Network Uplink Plans
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Scale your bot operations with premium infrastructure and extended capabilities.
        </p>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl flex flex-col sm:flex-row items-center gap-4 justify-between max-w-xl mx-auto mb-12 shadow-lg shadow-black/50">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <span className="font-medium text-foreground">Target Instance:</span>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="w-full bg-background border-border">
              <SelectValue placeholder="Select a bot to upgrade" />
            </SelectTrigger>
            <SelectContent>
              {botsLoading ? (
                <SelectItem value="loading" disabled>Loading...</SelectItem>
              ) : bots?.length === 0 ? (
                <SelectItem value="none" disabled>No bots available</SelectItem>
              ) : (
                bots?.map(bot => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name} {bot.subscription ? `(${bot.subscription.plan})` : '(Free)'}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {plansLoading ? (
        <div className="grid md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[400px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 items-end">
          {plans?.map((plan) => {
            const isPremium = plan.name.toLowerCase() === 'premium';
            const isBasic = plan.name.toLowerCase() === 'basic';
            
            return (
              <Card 
                key={plan.id} 
                className={`relative bg-card border-border flex flex-col transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                  isPremium ? 'border-primary shadow-primary/10 shadow-lg z-10 md:-translate-y-4' : ''
                }`}
              >
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Recommended
                  </div>
                )}
                <CardHeader className="text-center pb-2 pt-8">
                  <CardTitle className={`text-2xl font-bold ${isPremium ? 'text-primary' : 'text-foreground'}`}>
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="flex items-baseline justify-center gap-1 mt-4">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground font-medium">/mo</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 mt-6">
                  <ul className="space-y-4 text-sm text-muted-foreground">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-6 pb-8">
                  <Button 
                    className="w-full font-bold" 
                    variant={isPremium ? "default" : "outline"}
                    onClick={() => handleActivate(plan.name.toLowerCase() as "free" | "basic" | "premium")}
                    disabled={activateMutation.isPending}
                  >
                    {isPremium ? <CreditCard className="w-4 h-4 mr-2" /> : null}
                    Select {plan.name}
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
