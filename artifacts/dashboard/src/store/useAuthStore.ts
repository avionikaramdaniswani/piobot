import { create } from 'zustand';
import { User, AuthResponse } from '@workspace/api-client-react';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  login: (tokens: Omit<AuthResponse, 'user'>, user: User) => void;
  logout: () => void;
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
}));
