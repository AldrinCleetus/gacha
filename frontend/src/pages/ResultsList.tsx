import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { lotteryApi } from "@/lib/apiClient";
import { Draw } from "@/types";
import { getScheme, getUniqueSchemes } from "@/lib/schemes";
import {
  Search,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  X,
  Trophy,
  Clock,
} from "lucide-react";

const PAGE_SIZE = 6;

function formatPrizeHeadline(amount: number): string {
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${Number.isInteger(cr) ? cr : cr.toFixed(1)} Cr`;
  }
  if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(0)} Lakhs`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function ResultsList() {
  const navigate = useNavigate();

  const [draws, setDraws] = useState<Draw[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedScheme, setSelectedScheme] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const uniqueSchemes = getUniqueSchemes();

  // Debounce backend search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      if (lotteryApi.searchDraws) {
        const res = await lotteryApi.searchDraws({
          limit: PAGE_SIZE,
          offset,
          scheme: selectedScheme !== "ALL" ? selectedScheme : undefined,
          q: debouncedQuery || undefined,
        });
        setDraws(res.draws);
        setTotal(res.total);
        setHasMore(res.hasMore);
      } else {
        const all = await lotteryApi.getDraws();
        setDraws(all.slice(offset, offset + PAGE_SIZE));
        setTotal(all.length);
        setHasMore(offset + PAGE_SIZE < all.length);
      }
    } finally {
      setLoading(false);
    }
  }, [page, selectedScheme, debouncedQuery]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const handleSchemeChange = (val: string) => {
    setSelectedScheme(val);
    setPage(1);
  };

  const handleCopyTicket = (e: React.MouseEvent, drawId: string, ticketText: string) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(ticketText).catch(() => {});
    }
    setCopiedId(drawId);
    setTimeout(() => {
      setCopiedId((prev) => (prev === drawId ? null : prev));
    }, 1500);
  };

  const handleCardClick = (drawId: string) => {
    // Allow users to highlight & copy text naturally without accidental navigation
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim().length > 0) {
      return;
    }
    navigate(`/results/${drawId}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(total, (page - 1) * PAGE_SIZE + draws.length);

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
      {/* Header & Backend Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-main">Draw Results</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Past draw winning numbers and prize breakdowns
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search draw, scheme, or number..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs rounded-xl bg-surface border border-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 w-48 sm:w-56"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-main cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={selectedScheme}
            onChange={(e) => handleSchemeChange(e.target.value)}
            aria-label="Filter by lottery scheme"
            className="py-1.5 px-3 text-xs rounded-xl bg-surface border border-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="ALL">All Schemes</option>
            {uniqueSchemes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lottery Ticket-Style Draw Results List */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="py-16 text-center text-xs text-muted">Loading draws…</div>
        ) : draws.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-xs text-muted">No draws match your search.</p>
            {(debouncedQuery || selectedScheme !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setDebouncedQuery("");
                  setSelectedScheme("ALL");
                  setPage(1);
                }}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          draws.map((draw) => {
            const scheme = getScheme(draw.schemeCode);
            const prizeInfo = draw.headlinePrize || draw.prizes?.firstPrize;
            const dateStr = new Date(draw.drawDate).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const formattedTicket = prizeInfo
              ? `${prizeInfo.series ? `${prizeInfo.series} ` : ""}${prizeInfo.number}`
              : "";
            const isCopied = copiedId === draw.id;

            return (
              <div
                key={draw.id}
                role="link"
                tabIndex={0}
                onClick={() => handleCardClick(draw.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/results/${draw.id}`);
                  }
                }}
                className="group relative bg-surface rounded-2xl sm:rounded-3xl border border-border shadow-soft hover:shadow-card hover:border-primary/40 transition-all overflow-hidden cursor-pointer select-text"
              >
                <div className="flex flex-col sm:flex-row items-stretch">
                  {/* Left Perforated Stub (~30% width on sm+, subtle divider & punch notches) */}
                  <div className="sm:w-[30%] sm:min-w-[200px] px-4 py-3 sm:px-5 sm:py-4 flex sm:flex-col justify-between items-center sm:items-start gap-2 border-b sm:border-b-0 sm:border-r-2 border-dashed border-border/80 relative">
                    <div className="flex items-center gap-2 w-full justify-between">
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md font-mono"
                        style={{ backgroundColor: scheme.theme.bg, color: scheme.theme.text }}
                      >
                        {draw.id}
                      </span>
                      <span className="text-[11px] font-mono text-subtle">
                        ₹{scheme.price}
                      </span>
                    </div>

                    <div className="sm:space-y-0.5 text-right sm:text-left">
                      <h2 className="font-black text-sm sm:text-base uppercase tracking-tight text-main leading-tight">
                        {scheme.name}
                      </h2>
                      <div className="text-[11px] text-muted flex items-center justify-end sm:justify-start gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    {/* Top & Bottom Perforation Punch Notches (desktop) */}
                    <div
                      className="hidden sm:block absolute top-0 -mt-2 -right-2 w-3.5 h-3.5 rounded-full bg-page border border-border z-10 pointer-events-none"
                      aria-hidden="true"
                    />
                    <div
                      className="hidden sm:block absolute bottom-0 -mb-2 -right-2 w-3.5 h-3.5 rounded-full bg-page border border-border z-10 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Right Main Ticket Body */}
                  <div className="flex-1 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3 min-w-0">
                    <div className="space-y-1 min-w-0">
                      {draw.isPublished && prizeInfo ? (
                        <>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted">
                            <Trophy className="w-3 h-3 text-gold-text shrink-0" />
                            <span>1st Prize · {formatPrizeHeadline(prizeInfo.amount)}</span>
                            {draw.isDrawnToday && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary normal-case tracking-normal">
                                Today
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-xl bg-input-box border border-input-border font-mono font-extrabold text-sm sm:text-base tracking-widest text-main">
                              {formattedTicket}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleCopyTicket(e, draw.id, formattedTicket)}
                              title="Copy 1st prize number"
                              aria-label={`Copy ${formattedTicket}`}
                              className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-input-box transition-colors cursor-pointer"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </>
                      ) : draw.isPublished ? (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            Results Published
                          </span>
                          <div className="text-xs font-medium text-muted">
                            Click to view full prize breakdown
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Results pending (15:00 IST)</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-muted group-hover:text-primary transition-colors shrink-0">
                      <span className="hidden sm:inline">Breakdown</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border text-xs text-muted">
          <div>
            Showing <span className="font-semibold text-main">{startIdx}</span>–
            <span className="font-semibold text-main">{endIdx}</span> of{" "}
            <span className="font-semibold text-main">{total}</span> draws
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface border border-border text-main font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-input-box transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono text-xs text-main">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={!hasMore && page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface border border-border text-main font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-input-box transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
