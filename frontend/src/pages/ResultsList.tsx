import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { mockLotteryApi } from "@/lib/mockApi";
import { Draw } from "@/types";
import { getScheme } from "@/lib/schemes";
import { Search, Calendar, ChevronRight } from "lucide-react";

export function ResultsList() {
  const [draws, setDraws] = useState<Draw[]>([]);
  const [search, setSearch] = useState("");
  const [selectedScheme, setSelectedScheme] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockLotteryApi.getDraws().then((d) => {
      setDraws(d);
      setLoading(false);
    });
  }, []);

  const filtered = draws.filter((d) => {
    if (selectedScheme !== "ALL" && d.schemeCode !== selectedScheme) return false;
    if (search.trim()) {
      const q = search.toUpperCase();
      const scheme = getScheme(d.schemeCode);
      if (!d.id.includes(q) && !scheme.name.toUpperCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-main">Draw Results</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Past draw winning numbers and prize breakdowns
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search draw..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 w-36 sm:w-44"
            />
          </div>

          <select
            value={selectedScheme}
            onChange={(e) => setSelectedScheme(e.target.value)}
            className="py-1.5 px-3 text-xs rounded-xl bg-surface border border-border text-main focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="ALL">All Schemes</option>
            <option value="W">Win-Win (W)</option>
            <option value="S">Sthree Sakthi (S)</option>
            <option value="A">Akshaya (A)</option>
            <option value="K">Karunya Plus (K)</option>
          </select>
        </div>
      </div>

      {/* Draws List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-muted">Loading draws…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted">No draws match your search.</div>
        ) : (
          filtered.map((draw) => {
            const scheme = getScheme(draw.schemeCode);
            const dateStr = new Date(draw.drawDate).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <Link
                key={draw.id}
                to={`/results/${draw.id}`}
                className="flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-surface border border-border shadow-soft hover:shadow-card hover:border-primary/40 transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ backgroundColor: scheme.theme.bg, color: scheme.theme.text }}
                  >
                    {scheme.code}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm sm:text-base text-main">
                        {scheme.name}
                      </span>
                      <span className="font-mono text-xs text-muted font-semibold">
                        {draw.id}
                      </span>
                      {draw.isDrawnToday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Drawn today
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>{dateStr}</span>
                      <span>·</span>
                      <span>₹{scheme.price} per ticket</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    {draw.isPublished && draw.prizes ? (
                      <>
                        <div className="font-mono text-xs sm:text-sm font-bold text-main">
                          {draw.prizes.firstPrize.series} {draw.prizes.firstPrize.number}
                        </div>
                        <div className="text-[11px] text-muted">
                          1st: {draw.prizes.firstPrize.amount >= 10000000 ? `${draw.prizes.firstPrize.amount / 10000000} Cr` : `${draw.prizes.firstPrize.amount / 100000} Lakhs`}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted italic">Results pending</span>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-subtle" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
