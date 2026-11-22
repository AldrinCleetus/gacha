import { Draw, LotteryApi, SavedTicket, UserSession, UserStats } from "@/types/lottery";
import { generateSeedTickets, MOCK_USER, SEED_DRAWS } from "./mockData";
import { getScheme } from "./schemes";

const STORAGE_KEY_HISTORY = "bhagya_saved_tickets_v1";
const STORAGE_KEY_SESSION = "bhagya_user_session_v1";

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
    // Default to signed in mock user
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(MOCK_USER));
    return MOCK_USER;
  }

  async signInWithGoogle(): Promise<UserSession> {
    const session: UserSession = {
      user: {
        id: "usr_kerala_994",
        name: "Rahul Nair",
        email: "rahul.nair@example.com",
        avatarUrl: "",
      },
      isAuthenticated: true,
    };
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    }
    return session;
  }

  async signOut(): Promise<void> {
    const session: UserSession = {
      user: null,
      isAuthenticated: false,
    };
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    }
  }

  async getLatestDraw(schemeCode?: string): Promise<Draw> {
    if (schemeCode) {
      const match = SEED_DRAWS.find(
        (d) => d.schemeCode.toUpperCase() === schemeCode.toUpperCase()
      );
      if (match) return match;
    }
    return SEED_DRAWS[0];
  }

  async getDraws(): Promise<Draw[]> {
    return SEED_DRAWS;
  }

  async getDrawById(id: string): Promise<Draw | null> {
    const draw = SEED_DRAWS.find((d) => d.id === id);
    return draw || null;
  }

  async getHistory(): Promise<SavedTicket[]> {
    if (!this.isBrowser()) return generateSeedTickets();
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) {
      const initial = generateSeedTickets();
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return generateSeedTickets();
    }
  }

  async saveTicket(ticket: SavedTicket): Promise<void> {
    const history = await this.getHistory();
    // Add to front of history
    const updated = [ticket, ...history];
    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    }
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

    // Sort tickets chronologically for timeline calculation
    const chronoTickets = [...tickets].sort(
      (a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime()
    );

    let runningNet = 0;
    const historyTimeline: Array<{ date: string; cumulativeNet: number; cost: number; prize: number; ticket: string }> = [];

    for (const t of chronoTickets) {
      const cost = t.cost || 40;
      const prize = t.wonAmount || 0;
      totalSpent += cost;
      totalWon += prize;
      if (prize > bestWin) bestWin = prize;
      if (prize > 0) winCount++;

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
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ month, spent, won, net }) => ({ month, spent, won, net }));

    const netProfitLoss = totalWon - totalSpent;
    const winRate = totalTickets > 0 ? (winCount / totalTickets) * 100 : 0;

    return {
      totalTickets,
      totalSpent,
      totalWon,
      netProfitLoss,
      winRate: Number(winRate.toFixed(1)),
      bestWin,
      schemeBreakdown,
      monthlyBreakdown,
      historyTimeline,
    };
  }
}

export const mockLotteryApi = new MockLotteryApiService();
