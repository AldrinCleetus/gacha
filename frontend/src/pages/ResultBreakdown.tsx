import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { mockLotteryApi } from "@/lib/mockApi";
import { Draw, SavedTicket } from "@/types";
import { getScheme } from "@/lib/schemes";
import { formatINR } from "@/lib/checkTicket";
import { useCheckStore } from "@/store/useCheckStore";
import { ChevronDown, ChevronUp, ExternalLink, ArrowLeft, Trophy, Sparkles } from "lucide-react";

export function ResultBreakdown() {
  const { drawId } = useParams<{ drawId: string }>();
  const { ticketString, lastResult } = useCheckStore();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [userTicket, setUserTicket] = useState<SavedTicket | null>(null);
  const [showLowerTiers, setShowLowerTiers] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drawId) return;

    setLoading(true);
    mockLotteryApi.getDrawById(drawId).then((d) => {
      setDraw(d);
      setLoading(false);
    });

    mockLotteryApi.getHistory().then((history) => {
      const match = history.find((t) => t.drawId === drawId);
      if (match) {
        setUserTicket(match);
      }
    });
  }, [drawId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted">
        Loading draw breakdown…
      </div>
    );
  }

  if (!draw) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-main">Draw not found</h2>
        <p className="text-xs text-muted">
          We couldn&apos;t locate draw &quot;{drawId}&quot;. It may be invalid or not yet scheduled.
        </p>
        <Link
          to="/results"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all results</span>
        </Link>
      </div>
    );
  }

  const scheme = getScheme(draw.schemeCode);
  const isPublished = draw.isPublished && Boolean(draw.prizes);
  const prizes = draw.prizes;

  const userTicketNumber = userTicket?.ticketString || ticketString;
  const userDigits = userTicketNumber.replace(/[^0-9]/g, "");

  return (
    <div className="flex-1 max-w-[720px] mx-auto w-full py-4 sm:py-6 space-y-5">
      {/* Top back navigation & Title */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <Link
          to="/results"
          className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-main transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All draws</span>
        </Link>
        <span className="text-xs text-muted font-mono">{draw.id}</span>
      </div>

      {/* Draw Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-soft"
          style={{ backgroundColor: scheme.theme.bg, color: scheme.theme.text }}
        >
          {scheme.code}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-main">
            {scheme.name} Draw {draw.id}
          </h1>
          <p className="text-xs text-muted">
            {new Date(draw.drawDate).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {draw.isDrawnToday && " · Drawn today"}
          </p>
        </div>
      </div>

      {/* Unpublished Notice */}
      {!isPublished && (
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-soft text-center space-y-2">
          <p className="text-sm font-semibold text-main">Results not published yet</p>
          <p className="text-xs text-muted max-w-sm mx-auto">
            The draw has taken place today, but official numbers are being compiled. Please check back later.
          </p>
        </div>
      )}

      {/* User Ticket Hero Card (if user checked a ticket for this draw) */}
      {isPublished && userTicket && (
        <div
          className={`p-5 sm:p-6 rounded-3xl border shadow-soft ${
            userTicket.wonAmount > 0
              ? "bg-gold-bg/30 border-gold-border"
              : "bg-surface border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                Your Ticket
              </span>
              <div className="text-xl sm:text-2xl font-bold text-main font-mono mt-0.5">
                {userTicket.ticketString}
              </div>
            </div>
            <div className="text-right">
              {userTicket.wonAmount > 0 ? (
                <>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gold-bg text-gold-text border border-gold-border font-mono">
                    +{formatINR(userTicket.wonAmount)}
                  </span>
                  <div className="text-[11px] text-muted mt-1">{userTicket.result?.tier}</div>
                </>
              ) : (
                <span className="text-xs font-medium text-muted px-2.5 py-1 rounded-full bg-input-box">
                  No prize
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Official Prize Tiers Breakdown */}
      {isPublished && prizes && (
        <div className="space-y-4">
          {/* 1st Prize Hero Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-border shadow-soft space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-gold-text" />
                1st Prize · {formatINR(prizes.firstPrize.amount)}
              </span>
              <span className="text-xs text-muted">Bumper</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-main font-mono tracking-wide">
              {prizes.firstPrize.series} {prizes.firstPrize.number}
            </div>
          </div>

          {/* Consolation Prize */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-main">Consolation Prize</div>
              <div className="text-[11px] text-muted mt-0.5">
                All remaining series with number {prizes.firstPrize.number}
              </div>
            </div>
            <div className="font-bold text-sm text-main font-mono">
              {formatINR(prizes.consolationPrize.amount)}
            </div>
          </div>

          {/* 2nd Prize */}
          {prizes.secondPrize && (
            <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-soft flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-main">2nd Prize</div>
                <div className="text-base font-bold text-main font-mono mt-0.5">
                  {prizes.secondPrize.number}
                </div>
              </div>
              <div className="font-bold text-sm text-main font-mono">
                {formatINR(prizes.secondPrize.amount)}
              </div>
            </div>
          )}

          {/* 3rd Prize */}
          {prizes.thirdPrize && (
            <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-soft space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-main">3rd Prize</span>
                <span className="font-bold text-sm text-main font-mono">
                  {formatINR(prizes.thirdPrize.amount)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {prizes.thirdPrize.numbers.map((num) => (
                  <span
                    key={num}
                    className={`font-mono text-xs px-2.5 py-1 rounded-xl border ${
                      userDigits === num
                        ? "bg-gold-bg text-gold-text border-gold-border font-bold"
                        : "bg-input-box border-input-border text-main"
                    }`}
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last-4 Prize Groups (Collapsible for lower tiers) */}
          <div className="space-y-3">
            {prizes.last4Prizes
              .slice(0, showLowerTiers ? prizes.last4Prizes.length : 1)
              .map((group, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-soft space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-main">
                      {group.tier} (Last 4 digits)
                    </span>
                    <span className="font-bold text-sm text-main font-mono">
                      {formatINR(group.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {group.numbers.map((num) => {
                      const isMatch = userDigits.endsWith(num);
                      return (
                        <span
                          key={num}
                          className={`font-mono text-xs px-2.5 py-1 rounded-xl border transition-colors ${
                            isMatch
                              ? "bg-gold-bg text-gold-text border-gold-border font-bold"
                              : "bg-input-box border-input-border text-main"
                          }`}
                        >
                          {num} {isMatch ? "✓" : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}

            {prizes.last4Prizes.length > 1 && (
              <button
                onClick={() => setShowLowerTiers(!showLowerTiers)}
                className="w-full py-2.5 rounded-2xl border border-border bg-surface hover:bg-input-box text-xs font-semibold text-muted flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>
                  {showLowerTiers
                    ? "Hide lower prize tiers"
                    : `Show ${prizes.last4Prizes.length - 1} more lower prize tiers`}
                </span>
                {showLowerTiers ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Claim rules link */}
      <div className="pt-4 pb-8 text-center">
        <a
          href="https://statelottery.kerala.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span>Claim rules on the official site</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
