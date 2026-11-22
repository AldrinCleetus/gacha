import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WinCelebrationTier } from "@/types";

export type ForcedOutcome = WinCelebrationTier | null;

interface DemoState {
  isDemoMenuOpen: boolean;
  forcedOutcome: ForcedOutcome;
  mockNewUser: boolean;
  openDemoMenu: () => void;
  closeDemoMenu: () => void;
  setForcedOutcome: (outcome: ForcedOutcome) => void;
  setMockNewUser: (isNew: boolean) => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      isDemoMenuOpen: false,
      forcedOutcome: null,
      mockNewUser: false,
      openDemoMenu: () => set({ isDemoMenuOpen: true }),
      closeDemoMenu: () => set({ isDemoMenuOpen: false }),
      setForcedOutcome: (forcedOutcome) => set({ forcedOutcome }),
      setMockNewUser: (mockNewUser) => set({ mockNewUser }),
    }),
    {
      name: "gacha_demo_flags",
    }
  )
);
