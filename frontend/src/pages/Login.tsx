import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoogleSignIn } from "@/lib/auth/useGoogleSignIn";
import { usePageMeta } from "@/lib/usePageMeta";
import { CocolotMark } from "@/components/common/CocolotLogo";
import { ArrowRight } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const { signInWithGoogle, isLoaded, loading, error } = useGoogleSignIn();

  usePageMeta({
    title: "Sign in — cocolot",
    description: "Sign in with Google to save checked Kerala lottery tickets and track your stats across devices.",
    path: "/login",
    noIndex: true,
  });

  useEffect(() => {
    if (session.isAuthenticated) {
      navigate("/check", { replace: true });
    }
  }, [session.isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 max-w-sm mx-auto w-full text-center">
      <div className="mb-6 shadow-soft rounded-2xl">
        <CocolotMark className="w-16 h-16" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">
        Welcome to cocolot
      </h1>
      <p className="text-sm text-muted mt-2 mb-8 max-w-xs">
        A peaceful ticket checker and prize ledger for Kerala State Lotteries.
      </p>

      <button
        type="button"
        onClick={() => signInWithGoogle("/check")}
        disabled={!isLoaded || loading}
        className="w-full py-3.5 px-4 rounded-2xl bg-surface border border-border hover:bg-input-box text-main font-semibold text-sm shadow-soft flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
        <span>{loading ? "Connecting to Google…" : "Continue with Google"}</span>
      </button>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{error}</p>
      )}

      <Link
        to="/check"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-main mt-6 transition-colors"
      >
        <span>Continue without signing in</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
