import { create } from "zustand";
import { MatchResult, ParsedTicket } from "@/types";

interface CheckState {
  characters: string[]; // 8 characters
  ticketString: string;
  parsedTicket: ParsedTicket | null;
  selectedDrawId: string;
  lastResult: MatchResult | null;
  isReplay: boolean;
  setCharacters: (characters: string[]) => void;
  setSelectedDrawId: (selectedDrawId: string) => void;
  setLastResult: (lastResult: MatchResult | null, isReplay?: boolean) => void;
  clearInput: () => void;
}

export const useCheckStore = create<CheckState>()((set) => ({
  characters: ["", "", "", "", "", "", "", ""],
  ticketString: "",
  parsedTicket: null,
  selectedDrawId: "",
  lastResult: null,
  isReplay: false,
  setCharacters: (characters) =>
    set({
      characters,
      ticketString: characters.join(""),
    }),
  setSelectedDrawId: (selectedDrawId) => set({ selectedDrawId }),
  setLastResult: (lastResult, isReplay = false) => set({ lastResult, isReplay }),
  clearInput: () =>
    set({
      characters: ["", "", "", "", "", "", "", ""],
      ticketString: "",
      parsedTicket: null,
      lastResult: null,
      isReplay: false,
    }),
}));
