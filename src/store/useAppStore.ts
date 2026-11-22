import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MatchResult, ParsedTicket } from "@/types/lottery";

export type ForcedOutcome = "none" | "small" | "mid" | "jackpot" | null;

interface AppSettingsState {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleHaptics: () => void;
  setReducedMotion: (enabled: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      soundEnabled: false, // Per spec: Sound toggle in settings, off by default
      hapticsEnabled: true,
      reducedMotion: false,
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      toggleHaptics: () => set((s) => ({ hapticsEnabled: !s.hapticsEnabled })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    {
      name: "kerala-lottery-settings",
    }
  )
);

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
      name: "kerala-lottery-demo-flags",
    }
  )
);

interface ActiveCheckState {
  ticketInput: string;
  parsedTicket: ParsedTicket | null;
  selectedDrawId: string | null;
  lastCheckedResult: MatchResult | null;
  setTicketInput: (input: string, parsed: ParsedTicket | null) => void;
  setSelectedDrawId: (drawId: string | null) => void;
  setLastCheckedResult: (result: MatchResult | null) => void;
  resetCheck: () => void;
}

export const useActiveCheckStore = create<ActiveCheckState>()((set) => ({
  ticketInput: "",
  parsedTicket: null,
  selectedDrawId: null,
  lastCheckedResult: null,
  setTicketInput: (ticketInput, parsedTicket) => set({ ticketInput, parsedTicket }),
  setSelectedDrawId: (selectedDrawId) => set({ selectedDrawId }),
  setLastCheckedResult: (lastCheckedResult) => set({ lastCheckedResult }),
  resetCheck: () => set({ ticketInput: "", parsedTicket: null, lastCheckedResult: null }),
}));
