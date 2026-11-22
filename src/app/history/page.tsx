"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { mockLotteryApi } from "@/lib/mockApi";
import { SavedTicket } from "@/types/lottery";
import { getScheme } from "@/lib/schemes";
import { formatINR } from "@/lib/checkTicket";
import { useActiveCheckStore } from "@/store/useAppStore";
import {
  History,
  RotateCcw,
  Filter,
  Search,
  Sparkles,
  Trophy,
  Award,
  Calendar,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  const router = useRouter();
  const { setTicketInput, setSelectedDrawId, setLastCheckedResult } = useActiveCheckStore();

  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScheme, setSelectedScheme] = useState<string>("ALL");
  const [selectedOutcome, setSelectedOutcome] = useState<string>("ALL"); // "ALL" | "WON" | "LOST"
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "PRIZE">("NEWEST");
  const [searchQuery, setSearchQuery] = useState("");

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await mockLotteryApi.getHistory();
      setTickets(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => {
        // Scheme filter
        if (selectedScheme !== "ALL" && t.schemeCode !== selectedScheme) {
          return false;
        }
        // Outcome filter
        if (selectedOutcome === "WON" && (t.wonAmount || 0) <= 0) {
          return false;
        }
        if (selectedOutcome === "LOST" && (t.wonAmount || 0) > 0) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toUpperCase().replace(/\s+/g, "");
          const tkt = t.ticketString.replace(/\s+/g, "");
          if (!tkt.includes(q) && !t.drawId.toUpperCase().includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "PRIZE") {
          return (b.wonAmount || 0) - (a.wonAmount || 0);
        }
        if (sortBy === "OLDEST") {
          return new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime();
        }
        return new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime();
      });
  }, [tickets, selectedScheme, selectedOutcome, sortBy, searchQuery]);

  const handleReplayReveal = (ticket: SavedTicket) => {
    setTicketInput(ticket.ticketString, null);
    setSelectedDrawId(ticket.drawId);
    setLastCheckedResult(ticket.result);
    router.push("/reveal");
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Ticket History
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Every ticket checked, logged with draw results and replayable reveals.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {filteredTickets.length} of {tickets.length} Tickets
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Search input */}
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticket number or draw..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Scheme Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedScheme}
            onChange={(e) => setSelectedScheme(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Schemes</option>
            <option value="W">Win-Win (W)</option>
            <option value="S">Sthree Sakthi (S)</option>
            <option value="A">Akshaya (A)</option>
            <option value="K">Karunya Plus (K)</option>
          </select>
        </div>

        {/* Outcome Filter */}
        <div className="sm:col-span-2">
          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Results</option>
            <option value="WON">Wins Only</option>
            <option value="LOST">No Win</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="sm:col-span-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "NEWEST" | "OLDEST" | "PRIZE")}
            className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="PRIZE">Highest Win</option>
          </select>
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Tickets Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No tickets matched your filter criteria. Try clearing filters or check a new ticket!
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md mt-2"
            >
              Check a Ticket Now
            </Link>
          </div>
        ) : (
          filteredTickets.map((t) => {
            const scheme = getScheme(t.schemeCode);
            const isWin = (t.wonAmount || 0) > 0;
            const checkDate = new Date(t.checkedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left ticket details */}
                <div className="flex items-center gap-3.5">
                  {/* Scheme Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-sm shrink-0"
                    style={{ backgroundColor: scheme.theme.primary }}
                  >
                    {scheme.code}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide">
                        {t.ticketString}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {t.drawId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {scheme.name}
                      </span>
                      <span>•</span>
                      <span>{checkDate}</span>
                    </div>
                  </div>
                </div>

                {/* Right Prize & Replay Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left sm:text-right">
                    <div
                      className={`text-sm sm:text-base font-black tabular-nums ${
                        isWin
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isWin ? `+${formatINR(t.wonAmount)}` : "No Win"}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {t.result?.tierName || "No Prize"}
                    </div>
                  </div>

                  <button
                    onClick={() => handleReplayReveal(t)}
                    title="Replay Reveal Animation"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Replay</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
