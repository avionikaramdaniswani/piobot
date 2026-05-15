import { create } from 'zustand';
import { User, AuthResponse } from '@workspace/api-client-react';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  login: (tokens: Omit<AuthResponse, 'user'>, user: User) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,

  login: (tokens, user) => {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    set({ user, accessToken: tokens.accessToken });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null });
  },

  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return null;
    }
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        useAuthStore.getState().logout();
        return null;
      }
      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      set({ accessToken: data.accessToken, user: data.user });
      return data.accessToken as string;
    } catch {
      useAuthStore.getState().logout();
      return null;
    }
  },
}));
