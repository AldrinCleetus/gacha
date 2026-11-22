import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsState {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  hasSeenSoundToast: boolean;
  celebratedFirsts: {
    firstCheck: boolean;
    firstWin: boolean;
    bestWinAmount: number;
  };
  setTheme: (theme: ThemeMode) => void;
  initTheme: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  setHapticsEnabled: (enabled: boolean) => void;
  toggleHaptics: () => void;
  setReducedMotion: (enabled: boolean) => void;
  markSoundToastSeen: () => void;
  recordCheckFirsts: (wonAmount: number) => { isFirstCheck: boolean; isFirstWin: boolean; isNewBestWin: boolean };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",
      soundEnabled: false, // OFF by default per spec
      hapticsEnabled: true,
      reducedMotion: false,
      hasSeenSoundToast: false,
      celebratedFirsts: {
        firstCheck: false,
        firstWin: false,
        bestWinAmount: 0,
      },
      setTheme: (theme: ThemeMode) => {
        let resolved: "light" | "dark" = "light";
        if (theme === "system") {
          if (typeof window !== "undefined") {
            resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          }
        } else {
          resolved = theme;
        }

        if (typeof document !== "undefined") {
          if (resolved === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }

        set({ theme, resolvedTheme: resolved });
      },
      initTheme: () => {
        const { theme } = get();
        let resolved: "light" | "dark" = "light";
        if (theme === "system") {
          if (typeof window !== "undefined") {
            resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          }
        } else {
          resolved = theme;
        }

        if (typeof document !== "undefined") {
          if (resolved === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }

        set({ resolvedTheme: resolved });
      },
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      markSoundToastSeen: () => set({ hasSeenSoundToast: true }),
      recordCheckFirsts: (wonAmount: number) => {
        const state = get().celebratedFirsts;
        const isFirstCheck = !state.firstCheck;
        const isFirstWin = wonAmount > 0 && !state.firstWin;
        const isNewBestWin = wonAmount > 0 && wonAmount > state.bestWinAmount;

        set({
          celebratedFirsts: {
            firstCheck: true,
            firstWin: state.firstWin || wonAmount > 0,
            bestWinAmount: Math.max(state.bestWinAmount, wonAmount),
          },
        });

        return { isFirstCheck, isFirstWin, isNewBestWin };
      },
    }),
    {
      name: "gacha_settings_store",
    }
  )
);
