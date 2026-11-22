import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { mockLotteryApi } from "@/lib/mockApi";
import { SavedTicket } from "@/types";
import { getScheme } from "@/lib/schemes";
import { formatINR } from "@/lib/checkTicket";
import { useCheckStore } from "@/store/useCheckStore";
import { TicketGraphic } from "@/components/ticket/TicketGraphic";
import { Search, RotateCcw, Ticket as TicketIcon, Trophy, Sparkles } from "lucide-react";

export function MyTickets() {
  const navigate = useNavigate();
  const { setCharacters, setSelectedDrawId, setLastResult } = useCheckStore();

  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState("ALL"); // ALL | WON | LOST
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "PRIZE">("NEWEST");

  useEffect(() => {
    mockLotteryApi.getHistory().then((t) => {
      setTickets(t);
      setLoading(false);
    });
  }, []);

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
          <h1 className="text-2xl sm:text-3xl font-bold text-main">My Tickets</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Every ticket checked, rendered with its official lottery card visual
          </p>
        </div>

        <span className="text-xs font-semibold text-muted px-3 py-1 rounded-full bg-surface border border-border self-start sm:self-auto">
          {filteredTickets.length} of {tickets.length} tickets
        </span>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3 rounded-2xl bg-surface border border-border shadow-soft">
        <div className="sm:col-span-5 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search ticket or draw..."
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
            <option value="W">Win-Win (W)</option>
            <option value="S">Sthree Sakthi (S)</option>
            <option value="A">Akshaya (A)</option>
            <option value="K">Karunya Plus (K)</option>
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
          <div className="py-20 text-center text-xs text-muted">Loading tickets…</div>
        ) : Object.keys(groupedTickets).length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <TicketIcon className="w-8 h-8 text-subtle mx-auto" />
            <h3 className="text-sm font-bold text-main">No tickets found</h3>
            <p className="text-xs text-muted max-w-xs mx-auto">
              No tickets matched your search or filters. Check a new ticket from the Check tab!
            </p>
          </div>
        ) : (
          Object.entries(groupedTickets).map(([dayLabel, dayTickets]) => (
            <div key={dayLabel} className="space-y-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                {dayLabel}
              </div>

              {/* Grid of Dynamic Ticket Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dayTickets.map((t) => {
                  const isWin = t.wonAmount > 0;
                  const scheme = getScheme(t.schemeCode);

                  return (
                    <div
                      key={t.id}
                      className="bg-surface rounded-3xl p-4 border border-border shadow-soft flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group"
                    >
                      {/* Dynamic Ticket Visual for this ticket */}
                      <div className="w-full">
                        <TicketGraphic
                          ticketString={t.ticketString}
                          schemeCode={t.schemeCode}
                          drawId={t.drawId}
                          drawDate={t.drawDate}
                          price={t.cost}
                          state={isWin ? "won" : "lost"}
                          matchedIndices={t.result?.matchedIndices || []}
                          size="responsive"
                        />
                      </div>

                      {/* Card Info & Replay Action Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                        <div className="flex items-center gap-1.5">
                          {isWin ? (
                            <span className="font-bold text-gold-text flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5" />
                              {t.result?.tier || "Prize Winner"}
                            </span>
                          ) : (
                            <span className="text-muted">
                              {t.result?.tier || "No prize"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {isWin ? (
                            <span className="font-mono font-bold px-2.5 py-0.5 rounded-full bg-gold-bg text-gold-text border border-gold-border">
                              +{formatINR(t.wonAmount)}
                            </span>
                          ) : (
                            <span className="text-subtle font-mono text-[11px] px-2 py-0.5 rounded-full bg-input-box">
                              ₹0
                            </span>
                          )}

                          <button
                            onClick={() => handleReplay(t)}
                            title="Replay reveal animation"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-input-box hover:bg-input-border text-muted hover:text-main text-xs font-semibold transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Replay</span>
                          </button>
                        </div>
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
