import { Draw, LotteryApi, SavedTicket, UserSession, UserStats } from "@/types";
import { generateSeedTickets, SEED_DRAWS } from "./mockData";
import { MOCK_USER } from "./mockApi";
import {
  toFrontendDraw,
  toFrontendDrawListItem,
  BackendFullDraw,
  BackendDrawListItem,
} from "./adapters/drawAdapter";

const STORAGE_KEY_HISTORY = "gacha_saved_tickets_v2";
const STORAGE_KEY_SESSION = "gacha_user_session_v2";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/v1";

export class HttpLotteryApiService implements LotteryApi {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private isBrowser(): boolean {
    return typeof window !== "undefined";
  }

  async getSession(): Promise<UserSession> {
    if (!this.isBrowser()) return MOCK_USER;
    const stored = localStorage.getItem(STORAGE_KEY_SESSION);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(MOCK_USER));
    return MOCK_USER;
  }

  async signInWithGoogle(): Promise<UserSession> {
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(MOCK_USER));
    }
    return MOCK_USER;
  }

  async signOut(): Promise<void> {
    const guest: UserSession = { user: null, isAuthenticated: false };
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(guest));
    }
  }

  async getDraws(): Promise<Draw[]> {
    try {
      const res = await fetch(`${this.baseUrl}/draws?limit=50`);
      if (!res.ok) {
        throw new Error(`Failed to fetch draws: ${res.statusText}`);
      }
      const data = (await res.json()) as { draws: BackendDrawListItem[] };
      if (!data.draws || data.draws.length === 0) {
        return SEED_DRAWS;
      }
      return data.draws.map(toFrontendDrawListItem);
    } catch (err) {
      console.warn("Live API /draws unavailable, falling back to cached seed draws:", err);
      return SEED_DRAWS;
    }
  }

  async getLatestDraw(schemeCode?: string): Promise<Draw> {
    try {
      const url = schemeCode
        ? `${this.baseUrl}/draws/latest?scheme=${encodeURIComponent(schemeCode)}`
        : `${this.baseUrl}/draws/latest`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch latest draw: ${res.statusText}`);
      }
      const data = (await res.json()) as BackendFullDraw;
      return toFrontendDraw(data);
    } catch (err) {
      console.warn("Live API /draws/latest unavailable, falling back to seed draw:", err);
      const published = SEED_DRAWS.filter((d) => d.isPublished);
      if (schemeCode) {
        const match = published.find(
          (d) => d.schemeCode.toUpperCase() === schemeCode.toUpperCase()
        );
        if (match) return match;
      }
      return published[0] || SEED_DRAWS[0];
    }
  }

  async getDrawById(id: string): Promise<Draw | null> {
    try {
      const res = await fetch(`${this.baseUrl}/draws/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        const match = SEED_DRAWS.find((d) => d.id === id);
        return match || null;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch draw ${id}: ${res.statusText}`);
      }
      const data = (await res.json()) as BackendFullDraw;
      return toFrontendDraw(data);
    } catch (err) {
      console.warn(`Live API /draws/${id} unavailable, checking seeds:`, err);
      const match = SEED_DRAWS.find((d) => d.id === id);
      return match || null;
    }
  }

  async nudge(drawCode: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/draws/${encodeURIComponent(drawCode)}/nudge`, {
        method: "POST",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getHistory(): Promise<SavedTicket[]> {
    if (!this.isBrowser()) return generateSeedTickets();
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) {
      const seeded = generateSeedTickets();
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(seeded));
      return seeded;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return generateSeedTickets();
    }
  }

  async saveTicket(ticket: SavedTicket): Promise<boolean> {
    const history = await this.getHistory();
    const normalizedTicket = ticket.ticketString.replace(/\s+/g, "").toUpperCase();
    const isDuplicate = history.some(
      (t) =>
        t.ticketString.replace(/\s+/g, "").toUpperCase() === normalizedTicket &&
        t.drawId === ticket.drawId
    );

    if (isDuplicate) {
      return false;
    }

    const updated = [ticket, ...history];
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    }
    return true;
  }

  async resetHistory(seedTickets?: SavedTicket[]): Promise<void> {
    if (!this.isBrowser()) return;
    const list = seedTickets !== undefined ? seedTickets : generateSeedTickets();
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
  }

  async getStats(): Promise<UserStats> {
    const tickets = await this.getHistory();
    const totalTickets = tickets.length;

    let totalSpent = 0;
    let totalWon = 0;
    let bestWin = 0;
    let winCount = 0;

    const schemeBreakdown: Record<string, { count: number; spent: number; won: number; wins: number }> = {};
    const monthlyMap: Record<string, { spent: number; won: number; sortKey: string }> = {};

    const chronoTickets = [...tickets].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );

    let runningNet = 0;
    let longestDrySpell = 0;
    let currentDrySpell = 0;

    const historyTimeline: Array<{ date: string; cumulativeNet: number; cost: number; prize: number; ticket: string }> = [];

    for (const t of chronoTickets) {
      const cost = t.cost || 40;
      const prize = t.wonAmount || 0;
      totalSpent += cost;
      totalWon += prize;

      if (prize > bestWin) bestWin = prize;
      if (prize > 0) {
        winCount++;
        currentDrySpell = 0;
      } else {
        currentDrySpell++;
        if (currentDrySpell > longestDrySpell) {
          longestDrySpell = currentDrySpell;
        }
      }

      runningNet += prize - cost;
      const dateStr = t.checkedAt.split("T")[0];
      historyTimeline.push({
        date: dateStr,
        cumulativeNet: runningNet,
        cost,
        prize,
        ticket: t.ticketString,
      });

      const sCode = t.schemeCode || "W";
      if (!schemeBreakdown[sCode]) {
        schemeBreakdown[sCode] = { count: 0, spent: 0, won: 0, wins: 0 };
      }
      schemeBreakdown[sCode].count++;
      schemeBreakdown[sCode].spent += cost;
      schemeBreakdown[sCode].won += prize;
      if (prize > 0) schemeBreakdown[sCode].wins++;

      const d = new Date(t.checkedAt);
      const monthKey = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = { spent: 0, won: 0, sortKey };
      }
      monthlyMap[monthKey].spent += cost;
      monthlyMap[monthKey].won += prize;
    }

    const monthlyBreakdown = Object.entries(monthlyMap)
      .map(([month, data]) => ({
        month,
        spent: data.spent,
        won: data.won,
        net: data.won - data.spent,
        sortKey: data.sortKey,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let mostCheckedScheme = "Win-Win";
    let maxCount = 0;
    const schemeNames: Record<string, string> = {
      W: "Win-Win",
      S: "Sthree Sakthi",
      SS: "Sthree Sakthi",
      A: "Akshaya",
      AK: "Akshaya",
      K: "Karunya Plus",
      KN: "Karunya Plus",
      NR: "Nirmal",
      KR: "Karunya",
      SM: "Samrudhi",
      BT: "Bhagyathara",
    };
    for (const [code, item] of Object.entries(schemeBreakdown)) {
      if (item.count > maxCount) {
        maxCount = item.count;
        mostCheckedScheme = schemeNames[code] || code;
      }
    }

    const netProfitLoss = totalWon - totalSpent;
    const winRate = totalTickets > 0 ? Number(((winCount / totalTickets) * 100).toFixed(1)) : 0;

    return {
      totalTickets,
      totalSpent,
      totalWon,
      netProfitLoss,
      winRate,
      bestWin,
      longestDrySpell,
      mostCheckedScheme,
      schemeBreakdown,
      monthlyBreakdown,
      historyTimeline,
    };
  }
}

export const httpLotteryApi = new HttpLotteryApiService();
