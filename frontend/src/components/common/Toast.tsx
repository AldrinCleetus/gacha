import React from "react";
import { Link } from "react-router-dom";
import { Volume2, Trophy, Award, Sparkles, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "sound_prompt" | "first_check" | "first_win" | "new_best_win" | "info";
  title: string;
  description?: string;
  actionLink?: { to: string; text: string };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2">
      {toasts.map((toast) => {
        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-surface border border-border shadow-elevated rounded-2xl p-3.5 flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200"
          >
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-xl bg-input-box text-primary shrink-0 mt-0.5">
                {toast.type === "sound_prompt" && <Volume2 className="w-4 h-4" />}
                {toast.type === "first_check" && <Sparkles className="w-4 h-4" />}
                {toast.type === "first_win" && <Trophy className="w-4 h-4 text-gold-text" />}
                {toast.type === "new_best_win" && <Award className="w-4 h-4 text-gold-text" />}
                {toast.type === "info" && <Sparkles className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-semibold text-main">{toast.title}</div>
                {toast.description && (
                  <p className="text-[12px] text-muted mt-0.5">{toast.description}</p>
                )}
                {toast.actionLink && (
                  <Link
                    to={toast.actionLink.to}
                    onClick={() => onDismiss(toast.id)}
                    className="inline-block text-[12px] font-bold text-primary hover:underline mt-1"
                  >
                    {toast.actionLink.text} →
                  </Link>
                )}
              </div>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="text-muted hover:text-main p-1 rounded-lg"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
