import { create } from "zustand";
import { UserSession } from "@/types";

interface AuthState {
  session: UserSession;
  isLoaded: boolean;
  syncVersion: number;
  login: (user?: UserSession["user"]) => void;
  logout: () => void;
  setSession: (session: UserSession) => void;
  setLoaded: (loaded: boolean) => void;
  bumpSyncVersion: () => void;
}

const EMPTY_SESSION: UserSession = {
  user: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  session: EMPTY_SESSION,
  isLoaded: false,
  syncVersion: 0,
  login: (customUser) =>
    set({
      session: {
        user: customUser || null,
        isAuthenticated: Boolean(customUser),
      },
      isLoaded: true,
    }),
  logout: () =>
    set({
      session: EMPTY_SESSION,
      isLoaded: true,
    }),
  setSession: (session) => set({ session }),
  setLoaded: (isLoaded) => set({ isLoaded }),
  bumpSyncVersion: () => set((s) => ({ syncVersion: s.syncVersion + 1 })),
}));
