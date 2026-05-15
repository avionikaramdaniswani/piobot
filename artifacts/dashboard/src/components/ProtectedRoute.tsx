import { useAuthStore } from "@/store/useAuthStore";
import { Redirect } from "wouter";
import { useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, logout, user, login } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: me, isError, error } = useGetMe({
    query: {
      enabled: !!accessToken && !user,
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  useEffect(() => {
    if (me && accessToken) {
      login({ accessToken, refreshToken: localStorage.getItem("refreshToken") || "" }, me);
    }
  }, [me, accessToken, login]);

  useEffect(() => {
    if (isError) {
      const status = (error as any)?.status;
      // Only hard-logout if it's truly unauthorized (no refresh token saved) 
      // or if the error is NOT a 401 (refresh was already attempted by customFetch interceptor)
      const hasRefreshToken = !!localStorage.getItem("refreshToken");
      if (!hasRefreshToken || status !== 401) {
        queryClient.clear();
        logout();
      }
    }
  }, [isError, error, logout, queryClient]);

  if (!accessToken) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
