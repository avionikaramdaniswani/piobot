import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/useAuthStore";
import {
  LayoutDashboard,
  CreditCard,
  HelpCircle,
  Settings,
  MessageSquare,
  TerminalSquare,
  Filter,
  Menu as MenuIcon,
  LogOut,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

const PLAN_COLOR: Record<string, string> = {
  free: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  basic: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  premium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  active: boolean;
}

function NavItem({ href, label, icon: Icon, disabled, active }: NavItemProps) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-not-allowed select-none text-muted-foreground/40 group">
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </div>
        <span className="text-[10px] bg-secondary/60 text-muted-foreground/40 px-1.5 py-0.5 rounded font-mono">soon</span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) =>
    location === path ||
    (path === "/dashboard" && (location === "/" || location === ""));

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col fixed inset-y-0 left-0 z-30">

        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-2.5 border-b border-border/60">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Pio<span className="text-primary">Bot</span>
            <span className="text-muted-foreground font-normal">.io</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {/* Main */}
          <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} active={isActive("/dashboard")} />
          <NavItem href="/subscription" label="Pricing" icon={CreditCard} active={isActive("/subscription")} />
          <NavItem href="/faq" label="FAQ's" icon={HelpCircle} active={isActive("/faq")} />

          {/* Bot section */}
          <div className="pt-5 pb-1.5 px-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Bot
            </p>
          </div>
          <NavItem href="/config" label="Config" icon={Settings} active={isActive("/config")} />
          <NavItem href="/mess" label="Mess" icon={MessageSquare} disabled active={false} />
          <NavItem href="/command" label="Command" icon={TerminalSquare} disabled active={false} />
          <NavItem href="/filter" label="Filter Command" icon={Filter} disabled active={false} />
          <NavItem href="/menu" label="Menu" icon={MenuIcon} disabled active={false} />
        </nav>

        {/* User footer */}
        <div className="border-t border-border/60 p-2">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 uppercase">
              {user?.username?.charAt(0) ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground leading-tight">
                {user?.username}
              </p>
              <p className="text-[11px] text-muted-foreground capitalize leading-tight mt-0.5">
                {user?.role ?? "free"}
              </p>
            </div>
            <button
              onClick={logout}
              title="Keluar"
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-12 border-b border-border/60 bg-card/50 px-6 flex items-center justify-between shrink-0">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium capitalize">
              {location === "/" || location === "/dashboard"
                ? "Dashboard"
                : location.replace("/", "").charAt(0).toUpperCase() + location.replace("/", "").slice(1)}
            </span>
          </nav>
        </header>

        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
