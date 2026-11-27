import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoogleSignIn } from "@/lib/auth/useGoogleSignIn";
import { BookmarkCheck, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "gacha_signin_nudge_dismissed_at";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export function SignInNudgePopup() {
  const location = useLocation();
  const { session, isLoaded } = useAuthStore();
  const { signInWithGoogle, loading } = useGoogleSignIn();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoaded || session.isAuthenticated) {
      setVisible(false);
      return;
    }

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) || "0");
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
        return;
      }
    } catch {
      // ignore storage errors
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isLoaded, session.isAuthenticated]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {visible && !session.isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-20 md:bottom-6 right-4 z-40 max-w-xs sm:max-w-[340px] w-[calc(100%-2rem)] bg-surface/95 backdrop-blur-md border border-border shadow-elevated rounded-2xl p-3.5"
          role="dialog"
          aria-label="Save results with Google sign-in"
        >
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-input-box border border-input-border text-primary shrink-0 mt-0.5">
              <BookmarkCheck className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-main">
                Save your results &amp; track stats
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Sign in once with Google to save your checked tickets and view lifetime prize stats across devices.
              </p>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => signInWithGoogle(location.pathname)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-[11px] font-bold shadow-soft transition-colors cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-3 h-3 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
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
                  <span>{loading ? "Connecting…" : "Sign in with Google"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-2 py-1.5 text-[11px] font-semibold text-muted hover:text-main transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss sign-in prompt"
              className="text-muted hover:text-main p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
