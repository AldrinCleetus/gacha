import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserSession } from "@/types";

const DEFAULT_USER: UserSession = {
  user: {
    id: "usr_gacha_demo",
    name: "Rahul Nair",
    email: "rahul@example.com",
    avatarUrl: "",
  },
  isAuthenticated: true,
};

interface AuthState {
  session: UserSession;
  login: (user?: UserSession["user"]) => void;
  logout: () => void;
  setSession: (session: UserSession) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: DEFAULT_USER,
      login: (customUser) =>
        set({
          session: {
            user: customUser || DEFAULT_USER.user,
            isAuthenticated: true,
          },
        }),
      logout: () =>
        set({
          session: {
            user: null,
            isAuthenticated: false,
          },
        }),
      setSession: (session) => set({ session }),
    }),
    {
      name: "gacha_auth_session",
    }
  )
);
