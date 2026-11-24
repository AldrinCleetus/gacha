import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WinCelebrationTier } from "@/types";

export type ForcedOutcome = WinCelebrationTier | null;

interface DemoState {
  isDemoMenuOpen: boolean;
  forcedOutcome: ForcedOutcome;
  mockNewUser: boolean;
  useMockApi: boolean; // false = Live Backend API (:3001), true = Static Mock Seeds
  openDemoMenu: () => void;
  closeDemoMenu: () => void;
  setForcedOutcome: (outcome: ForcedOutcome) => void;
  setMockNewUser: (isNew: boolean) => void;
  setUseMockApi: (useMock: boolean) => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      isDemoMenuOpen: false,
      forcedOutcome: null,
      mockNewUser: false,
      useMockApi: false, // Default to Live Backend API
      openDemoMenu: () => set({ isDemoMenuOpen: true }),
      closeDemoMenu: () => set({ isDemoMenuOpen: false }),
      setForcedOutcome: (forcedOutcome) => set({ forcedOutcome }),
      setMockNewUser: (mockNewUser) => set({ mockNewUser }),
      setUseMockApi: (useMockApi) => set({ useMockApi }),
    }),
    {
      name: "gacha_demo_flags",
    }
  )
);
