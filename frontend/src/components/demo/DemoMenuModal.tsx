import React from "react";
import { useDemoStore, ForcedOutcome } from "@/store/useDemoStore";
import { mockLotteryApi } from "@/lib/mockApi";
import { X, Trophy, Award, Sparkles, Frown, CheckCircle2, UserCheck, RefreshCw } from "lucide-react";

export function DemoMenuModal() {
  const {
    isDemoMenuOpen,
    closeDemoMenu,
    forcedOutcome,
    setForcedOutcome,
    mockNewUser,
    setMockNewUser,
  } = useDemoStore();

  if (!isDemoMenuOpen) return null;

  const outcomes: Array<{ id: ForcedOutcome; label: string; desc: string; icon: React.ElementType }> = [
    {
      id: "jackpot",
      label: "Force Jackpot (1st Prize)",
      desc: "Full 8-character match, ₹75 Lakhs burst",
      icon: Trophy,
    },
    {
      id: "mid",
      label: "Force Mid Win (Consolation)",
      desc: "Consolation ₹8,000 (same digits, other series)",
      icon: Award,
    },
    {
      id: "small",
      label: "Force Small Win (Last 4)",
      desc: "Last 4 digits match ₹5,000",
      icon: Sparkles,
    },
    {
      id: "none",
      label: "Force No Prize",
      desc: "Calm, gentle, non-punishing resolution",
      icon: Frown,
    },
    {
      id: null,
      label: "Normal Draw Evaluation",
      desc: "Check ticket against actual drawn numbers",
      icon: CheckCircle2,
    },
  ];

  const handleSeedTickets = async () => {
    await mockLotteryApi.resetHistory();
    setMockNewUser(false);
    window.location.reload();
  };

  const handleSetNewUser = async () => {
    await mockLotteryApi.resetHistory([]);
    setMockNewUser(true);
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-elevated max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-main flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-gold-text" />
              Demo Controls
            </h3>
            <p className="text-xs text-muted">Long-press wordmark menu for rapid evaluation testing</p>
          </div>
          <button
            onClick={closeDemoMenu}
            className="p-1 rounded-xl text-muted hover:text-main"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 py-4 overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-muted block mb-2">
              Force Next Reveal Outcome
            </label>
            <div className="space-y-1.5">
              {outcomes.map((item) => {
                const isSelected = forcedOutcome === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={String(item.id)}
                    onClick={() => setForcedOutcome(item.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "border-primary bg-primary-subtle text-primary"
                        : "border-border hover:bg-input-box text-main"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div className="text-[11px] text-muted truncate">{item.desc}</div>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted block mb-2">
              User State & Data Simulation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSeedTickets}
                className="p-3 rounded-2xl border border-border bg-input-box hover:opacity-90 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-main">
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  Seed ~40 Tickets
                </div>
                <p className="text-[11px] text-muted mt-0.5">Realistic history & stats</p>
              </button>

              <button
                onClick={handleSetNewUser}
                className="p-3 rounded-2xl border border-border bg-input-box hover:opacity-90 text-left transition-all"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-main">
                  <UserCheck className="w-3.5 h-3.5 text-gold-text" />
                  New User State
                </div>
                <p className="text-[11px] text-muted mt-0.5">Empty dashboard & tickets</p>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-input-box border border-border text-xs space-y-1">
            <span className="font-semibold text-main block">Known Winning Sample Tickets:</span>
            <div className="font-mono text-[11px] text-muted">
              • 1st Prize: <span className="font-bold text-primary">WA 584920</span> (₹75L)<br />
              • Consolation: <span className="font-bold text-primary">WB 584920</span> (₹8k)<br />
              • Last 4 Digits: <span className="font-bold text-primary">WA 114920</span> (₹5k)<br />
              • No Win: <span className="font-bold text-muted">WA 999999</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex justify-end">
          <button
            onClick={closeDemoMenu}
            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
