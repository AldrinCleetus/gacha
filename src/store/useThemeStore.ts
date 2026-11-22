import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",
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
    }),
    {
      name: "kerala-lottery-theme",
    }
  )
);
