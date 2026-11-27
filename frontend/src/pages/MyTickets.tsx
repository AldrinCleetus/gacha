import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { lotteryApi } from "@/lib/apiClient";
import { SavedTicket } from "@/types";
import { getScheme, getUniqueSchemes } from "@/lib/schemes";
import { formatINR } from "@/lib/checkTicket";
import { useCheckStore } from "@/store/useCheckStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoogleSignIn } from "@/lib/auth/useGoogleSignIn";
import { usePageMeta } from "@/lib/usePageMeta";
import { TicketGraphic } from "@/components/ticket/TicketGraphic";
import { Search, RotateCcw, Ticket as TicketIcon, Trophy } from "lucide-react";

export function MyTickets() {
  const navigate = useNavigate();
  const { setCharacters, setSelectedDrawId, setLastResult } = useCheckStore();
  const { session, isLoaded, syncVersion } = useAuthStore();
  const { signInWithGoogle, loading: googleLoading } = useGoogleSignIn();

  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL"); // ALL | WON | LOST
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "PRIZE">("NEWEST");

  usePageMeta({
    title: "My Lotteries — cocolot",
    description: "Review your saved Kerala lottery ticket checks, matches, and wins in cocolot.",
    path: "/tickets",
    noIndex: true,
  });

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    setLoading(true);
    lotteryApi
      .getHistory()
      .then((t) => {
        if (!cancelled) {
          setTickets(t);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, session.isAuthenticated, session.user?.id, syncVersion]);

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        if (schemeFilter !== "ALL" && t.schemeCode !== schemeFilter) return false;
        if (outcomeFilter === "WON" && t.wonAmount <= 0) return false;
        if (outcomeFilter === "LOST" && t.wonAmount > 0) return false;
        if (search.trim()) {
          const q = search.toUpperCase().replace(/\s+/g, "");
          const tkt = t.ticketString.replace(/\s+/g, "");
          if (!tkt.includes(q) && !t.drawId.toUpperCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "PRIZE") return b.wonAmount - a.wonAmount;
        if (sortBy === "OLDEST") {
          return new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime();
        }
        return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
      });
  }, [tickets, schemeFilter, outcomeFilter, sortBy, search]);

  // Group tickets by day
  const groupedTickets = useMemo(() => {
    const groups: Record<string, SavedTicket[]> = {};
    for (const t of filteredTickets) {
      const date = new Date(t.checkedAt);
      const today = new Date();
      const isToday = date.toDateString() === today.toDateString();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      let label = date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      if (isToday) label = "Today";
      else if (isYesterday) label = "Yesterday";

      if (!groups[label]) groups[label] = [];
      groups[label].push(t);
    }
    return groups;
  }, [filteredTickets]);

  const handleReplay = (ticket: SavedTicket) => {
    const parsed = ticket.ticketString.replace(/\s+/g, "").toUpperCase();
    const chars = ["", "", "", "", "", "", "", ""];
    for (let i = 0; i < 8; i++) chars[i] = parsed.charAt(i) || "";
    setCharacters(chars);
    setSelectedDrawId(ticket.drawId);
    setLastResult(ticket.result, true); // true = replay, never saves duplicate
    navigate("/check/reveal");
  };

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-main">My Lotteries</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Every lottery checked, rendered with its official lottery card visual
          </p>
        </div>

        <span className="text-xs font-semibold text-muted px-3 py-1 rounded-full bg-surface border border-border self-start sm:self-auto">
          {filteredTickets.length} of {tickets.length} lotteries
        </span>
      </div>

      {/* Guest Cloud-Sync Callout (only when signed out) */}
      {isLoaded && !session.isAuthenticated && (
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted">
            <span className="font-bold text-main">Sync across devices:</span> Sign in once with Google to persist your checked lotteries safely in your account.
          </div>
          <button
            type="button"
            onClick={() => signInWithGoogle("/tickets")}
            disabled={googleLoading}
            className="px-3.5 py-2 rounded-xl bg-input-box border border-input-border hover:border-primary/40 text-xs font-semibold text-main flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? "Connecting…" : "Continue with Google"}</span>
          </button>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-2xl bg-surface border border-border shadow-soft">
        <div className="sm:col-span-5 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search lottery or draw..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-input-box border border-input-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={schemeFilter}
            onChange={(e) => setSchemeFilter(e.target.value)}
            className="w-full py-1.5 px-3 text-xs rounded-xl bg-input-box border border-input-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="ALL">All Schemes</option>
            {getUniqueSchemes().map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full py-1.5 px-3 text-xs rounded-xl bg-input-box border border-input-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="ALL">All Outcomes</option>
            <option value="WON">Wins Only</option>
            <option value="LOST">No Prize</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full py-1.5 px-3 text-xs rounded-xl bg-input-box border border-input-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="PRIZE">Highest Win</option>
          </select>
        </div>
      </div>

      {/* Dynamic Ticket Cards Grouped by Day */}
      <div className="space-y-8">
        {loading ? (
          <div className="py-20 text-center text-xs text-muted">Loading lotteries…</div>
        ) : Object.keys(groupedTickets).length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <TicketIcon className="w-8 h-8 text-subtle mx-auto" />
            <h3 className="text-sm font-bold text-main">No lotteries found</h3>
            <p className="text-xs text-muted max-w-xs mx-auto">
              No lotteries matched your search or filters. Check a new lottery from the Check tab!
            </p>
          </div>
        ) : (
          Object.entries(groupedTickets).map(([dayLabel, dayTickets]) => (
            <div key={dayLabel} className="space-y-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                {dayLabel}
              </div>

              {/* List of Dynamic Lottery Cards */}
              <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
                {dayTickets.map((t) => {
                  const isWin = t.wonAmount > 0;
                  const scheme = getScheme(t.schemeCode);

                  return (
                    <div
                      key={t.id}
                      className="group flex flex-col gap-2 w-full"
                    >
                      {/* Dynamic Ticket Visual */}
                      <TicketGraphic
                        ticketString={t.ticketString}
                        schemeCode={t.schemeCode}
                        drawId={t.drawId}
                        drawDate={t.drawDate}
                        price={t.cost}
                        state={isWin ? "won" : "lost"}
                        matchedIndices={t.result?.matchedIndices || []}
                        tierLabel={t.result?.tier}
                        seriesLabel={`${scheme.name} series ${t.series}`}
                        size="responsive"
                      />

                      {/* Card Info & Replay Action Bar */}
                      <div className="flex items-center justify-between px-2 text-xs">
                        <div className="flex items-center gap-2">
                          {isWin ? (
                            <span className="font-bold text-gold-text flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-bg/60 border border-gold-border shadow-2xs">
                              <Trophy className="w-3.5 h-3.5 text-gold-text" />
                              <span>{t.result?.tier || "Prize Winner"}</span>
                              <span className="font-mono font-black ml-1">+{formatINR(t.wonAmount)}</span>
                            </span>
                          ) : (
                            <span className="text-muted px-3 py-1 rounded-full bg-input-box/80 border border-border">
                              {t.result?.tier || "No prize"}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleReplay(t)}
                          title="Replay reveal animation"
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface hover:bg-input-box border border-border text-muted hover:text-main text-xs font-semibold shadow-soft transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Replay</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
