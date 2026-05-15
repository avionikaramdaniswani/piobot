import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import BotsList from "@/pages/bots/index";
import BotDetail from "@/pages/bots/[id]";
import Subscription from "@/pages/subscription";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      <Route path="/">
        <ProtectedLayout>
          <Dashboard />
        </ProtectedLayout>
      </Route>
      <Route path="/dashboard">
        <ProtectedLayout>
          <Dashboard />
        </ProtectedLayout>
      </Route>
      <Route path="/bots">
        <ProtectedLayout>
          <BotsList />
        </ProtectedLayout>
      </Route>
      <Route path="/bots/:id">
        {params => (
          <ProtectedLayout>
            <BotDetail id={params.id} />
          </ProtectedLayout>
        )}
      </Route>
      <Route path="/subscription">
        <ProtectedLayout>
          <Subscription />
        </ProtectedLayout>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const refreshAccessToken = useAuthStore(s => s.refreshAccessToken);

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("accessToken"));
    setUnauthorizedHandler(refreshAccessToken);
  }, [refreshAccessToken]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
