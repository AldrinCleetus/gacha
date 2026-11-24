import { LotteryApi } from "@/types";
import { mockLotteryApi } from "./mockApi";
import { httpLotteryApi } from "./api";
import { useDemoStore } from "@/store/useDemoStore";

/**
 * Returns either the Live HTTP backend API or Mock static API
 * based on user settings and demo flags.
 */
export function getLotteryApi(): LotteryApi {
  const isMock = useDemoStore.getState().useMockApi;
  return isMock ? mockLotteryApi : httpLotteryApi;
}

/**
 * Dynamic proxy object that routes all LotteryApi calls to the currently active
 * API service (Live Fastify Backend by default, or Mock Data when Demo mode is enabled).
 */
export const lotteryApi: LotteryApi = {
  getSession: () => getLotteryApi().getSession(),
  signInWithGoogle: () => getLotteryApi().signInWithGoogle(),
  signOut: () => getLotteryApi().signOut(),
  getDraws: () => getLotteryApi().getDraws(),
  getLatestDraw: (schemeCode?: string) => getLotteryApi().getLatestDraw(schemeCode),
  getDrawById: (id: string) => getLotteryApi().getDrawById(id),
  saveTicket: (ticket) => getLotteryApi().saveTicket(ticket),
  getHistory: () => getLotteryApi().getHistory(),
  getStats: () => getLotteryApi().getStats(),
  resetHistory: (seed) => getLotteryApi().resetHistory(seed),
};

export { mockLotteryApi } from "./mockApi";
export { httpLotteryApi } from "./api";
