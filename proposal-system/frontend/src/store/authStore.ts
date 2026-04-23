import { create } from 'zustand';
import { api } from '../services/api';
import type { User, AuthResponse } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const response = await api.login(email, password) as AuthResponse;

    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);

    set({
      user: response.user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    set({
      user: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await api.getMe() as { user: User };
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await api.refreshToken(refreshToken) as AuthResponse;
          localStorage.setItem('access_token', refreshResponse.access_token);
          localStorage.setItem('refresh_token', refreshResponse.refresh_token);

          const meResponse = await api.getMe() as { user: User };
          set({
            user: meResponse.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch {
          // Refresh failed
        }
      }

      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
