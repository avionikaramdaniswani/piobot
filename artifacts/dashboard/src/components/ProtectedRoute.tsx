import { useAuthStore } from "@/store/useAuthStore";
import { Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { setAuthTokenGetter, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, logout, user, login } = useAuthStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("accessToken"));
  }, []);

  const { data: me, isError } = useGetMe({
    query: {
      enabled: !!accessToken && !user,
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  });

  useEffect(() => {
    if (me && accessToken) {
      login({ accessToken, refreshToken: localStorage.getItem("refreshToken") || "" }, me);
    }
  }, [me, accessToken, login]);

  useEffect(() => {
    if (isError) {
      logout();
      setLocation("/login");
    }
  }, [isError, logout, setLocation]);

  if (!accessToken) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
