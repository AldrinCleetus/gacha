import {
  Draw,
  DrawsSearchParams,
  DrawsSearchResult,
  LotteryApi,
  MatchResult,
  SavedTicket,
  UserSession,
  UserStats,
} from "@/types";
import { generateSeedTickets, SEED_DRAWS } from "./mockData";
import { checkTicket } from "./checkTicket";

const STORAGE_KEY_HISTORY = "gacha_saved_tickets_v2";
const STORAGE_KEY_SESSION = "gacha_user_session_v2";

export const MOCK_USER: UserSession = {
  user: {
    id: "usr_gacha_demo",
    name: "Rahul Nair",
    email: "rahul@example.com",
    avatarUrl: "",
  },
  isAuthenticated: true,
};

class MockLotteryApiService implements LotteryApi {
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

  async getLatestDraw(schemeCode?: string): Promise<Draw> {
    // Only return published draws for latest check
    const published = SEED_DRAWS.filter((d) => d.isPublished);
    if (schemeCode) {
      const match = published.find(
        (d) => d.schemeCode.toUpperCase() === schemeCode.toUpperCase()
      );
      if (match) return match;
    }
    return published[0] || SEED_DRAWS[0];
  }

  async getDraws(): Promise<Draw[]> {
    return SEED_DRAWS;
  }

  async searchDraws(params: DrawsSearchParams): Promise<DrawsSearchResult> {
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;
    const q = (params.q || "").trim().toUpperCase();
    const filtered = SEED_DRAWS.filter((d) => {
      if (params.scheme && params.scheme !== "ALL" && d.schemeCode !== params.scheme) {
        return false;
      }
      if (q) {
        const firstNum = d.prizes
          ? `${d.prizes.firstPrize.series}${d.prizes.firstPrize.number}`.toUpperCase()
          : "";
        if (
          !d.id.toUpperCase().includes(q) &&
          !d.drawDate.includes(q) &&
          !d.schemeCode.toUpperCase().includes(q) &&
          !firstNum.includes(q.replace(/\s+/g, ""))
        ) {
          return false;
        }
      }
      return true;
    });
    const slice = filtered.slice(offset, offset + limit);
    return {
      draws: slice,
      limit,
      offset,
      total: filtered.length,
      hasMore: offset + slice.length < filtered.length,
    };
  }

  async getDrawById(id: string): Promise<Draw | null> {
    const draw = SEED_DRAWS.find((d) => d.id === id);
    return draw || null;
  }

  async checkTicket(ticket: string, drawId: string): Promise<MatchResult> {
    const draw = await this.getDrawById(drawId);
    if (!draw) {
      return {
        kind: "none",
        tier: "Draw Not Found",
        amount: 0,
        formattedAmount: "₹0",
        matchedIndices: [],
        summary: "Unable to find draw results",
      };
    }
    return checkTicket(ticket, draw);
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
    // Unique check: (ticketString, drawId)
    const normalizedTicket = ticket.ticketString.replace(/\s+/g, "").toUpperCase();
    const isDuplicate = history.some(
      (t) =>
        t.ticketString.replace(/\s+/g, "").toUpperCase() === normalizedTicket &&
        t.drawId === ticket.drawId
    );

    if (isDuplicate) {
      return false; // Skip duplicate per spec
    }

    const updated = [ticket, ...history];
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    }
    return true;
  }

  async resetHistory(seedTickets?: SavedTicket[]): Promise<void> {
    const list = seedTickets !== undefined ? seedTickets : generateSeedTickets();
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(list));
    }
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

    // Sort tickets chronologically for timeline and dry spell calculation
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

      // Scheme breakdown
      const sCode = t.schemeCode || "W";
      if (!schemeBreakdown[sCode]) {
        schemeBreakdown[sCode] = { count: 0, spent: 0, won: 0, wins: 0 };
      }
      schemeBreakdown[sCode].count++;
      schemeBreakdown[sCode].spent += cost;
      schemeBreakdown[sCode].won += prize;
      if (prize > 0) schemeBreakdown[sCode].wins++;

      // Monthly breakdown
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

    // Find most checked scheme
    let mostCheckedScheme = "Win-Win";
    let maxCount = 0;
    const schemeNames: Record<string, string> = {
      W: "Win-Win",
      S: "Sthree Sakthi",
      A: "Akshaya",
      K: "Karunya Plus",
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

export const mockLotteryApi = new MockLotteryApiService();
