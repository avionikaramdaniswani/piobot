import { useState } from "react";
import { Link } from "wouter";
import { useListBots, useCreateBot, getListBotsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Bot as BotIcon, Plus, Search, Terminal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function BotsList() {
  const { data: bots, isLoading } = useListBots({
    query: { queryKey: getListBotsQueryKey() }
  });
  const createBotMutation = useCreateBot();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [newBotPrefix, setNewBotPrefix] = useState("!");

  const handleCreateBot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBotMutation.mutateAsync({
        data: { name: newBotName, prefix: newBotPrefix }
      });
      queryClient.invalidateQueries({ queryKey: getListBotsQueryKey() });
      setIsDialogOpen(false);
      setNewBotName("");
      setNewBotPrefix("!");
      toast({ title: "Instance Created", description: "New bot instance initialized successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to create bot." });
    }
  };

  const filteredBots = bots?.filter(bot => {
    if (filter !== "all" && bot.status !== filter) return false;
    if (search && !bot.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="w-8 h-8 text-primary" />
            Bot Instances
          </h1>
          <p className="text-muted-foreground mt-2">Manage and monitor all deployed bots.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Initialize Bot
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Initialize New Instance</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBot} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Instance Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. SalesBot-Alpha"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">Command Prefix</Label>
                <Input
                  id="prefix"
                  placeholder="!"
                  value={newBotPrefix}
                  onChange={(e) => setNewBotPrefix(e.target.value)}
                  className="bg-background font-mono"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBotMutation.isPending}>
                  {createBotMutation.isPending ? "Deploying..." : "Deploy Instance"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search instances..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {["all", "connected", "connecting", "disconnected", "inactive"].map((status) => (
            <Button 
              key={status} 
              variant={filter === status ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilter(status)}
              className="capitalize whitespace-nowrap"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filteredBots?.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-12 text-center bg-card/50">
          <BotIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground">No instances matched</h3>
          <p className="text-muted-foreground text-sm mt-1">Try adjusting your filters or deploy a new instance.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBots?.map((bot, idx) => (
            <Link key={bot.id} href={`/bots/${bot.id}`}>
              <Card className="hover:bg-secondary/80 transition-all duration-300 cursor-pointer border-border group" style={{ animationDelay: `${idx * 50}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">{bot.name}</CardTitle>
                    <Badge variant="outline" className={
                      bot.status === 'connected' ? 'bg-primary/10 text-primary border-primary/20' :
                      bot.status === 'connecting' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                      'bg-destructive/10 text-destructive border-destructive/20'
                    }>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
                        bot.status === 'connected' ? 'bg-primary animate-pulse' :
                        bot.status === 'connecting' ? 'bg-yellow-500 animate-bounce' :
                        'bg-destructive'
                      }`}></span>
                      {bot.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground font-mono truncate">
                    {bot.phoneNumber || "No number assigned"}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs border-t border-border pt-4">
                    <span className="text-muted-foreground">ID: <span className="font-mono text-foreground opacity-70">{bot.id.slice(0, 8)}...</span></span>
                    {bot.subscription ? (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {bot.subscription.plan}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic">Free Tier</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
