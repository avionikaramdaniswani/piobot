import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/useAuthStore";
import { LayoutDashboard, CreditCard, LogOut, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/subscription", label: "Paket & Langganan", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-60 border-r border-border bg-card flex flex-col shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Pio<span className="text-primary">Bot</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pt-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.href ||
              location.startsWith(item.href + "/") ||
              (item.href === "/dashboard" && (location === "/" || location === ""));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-border mt-auto">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {user?.username?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-5 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
