import React, { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDemoStore } from "@/store/useDemoStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useGoogleSignIn } from "@/lib/auth/useGoogleSignIn";
import { CocolotLogo } from "@/components/common/CocolotLogo";
import { Sun, Moon, Sparkles, Settings as SettingsIcon, LogOut } from "lucide-react";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openDemoMenu } = useDemoStore();
  const { theme, setTheme, resolvedTheme } = useSettingsStore();
  const { session, logout } = useAuthStore();
  const { signInWithGoogle, signOut, loading: googleLoading } = useGoogleSignIn();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const didLongPressRef = useRef(false);

  const startLongPress = () => {
    setIsPressing(true);
    didLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      openDemoMenu();
      setIsPressing(false);
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([40, 50, 40]);
      }
    }, 750);
  };

  const cancelLongPress = () => {
    setIsPressing(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleLogoClick = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    navigate("/check");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const navItems = [
    { path: "/check", label: "Check" },
    { path: "/results", label: "Results" },
    { path: "/tickets", label: "My Lotteries" },
    { path: "/dashboard", label: "Dashboard" },
  ];

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 bg-page/80 dark:bg-page/80 backdrop-blur-md border-b border-border transition-colors">
      <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Clickable logo "cocolot" -> Home (long press opens demo controls) */}
        <button
          type="button"
          onClick={handleLogoClick}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          className="select-none cursor-pointer flex items-center bg-transparent border-0 p-0 focus:outline-none"
          title="Go to Home (hold for demo controls)"
          aria-label="cocolot home"
        >
          <CocolotLogo
            markClassName="w-7 h-7 sm:w-8 sm:h-8"
            textClassName="text-xl sm:text-2xl font-extrabold tracking-tight text-main"
            className={`transition-transform ${
              isPressing ? "scale-95 opacity-70" : "hover:opacity-90"
            }`}
          />
        </button>

        {/* Centre: Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-surface/60 dark:bg-surface/40 p-1 rounded-2xl hairline-border">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/check" && location.pathname.startsWith("/check"));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-4 py-1.5 rounded-xl text-[14px] font-semibold transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-soft"
                    : "text-muted hover:text-main hover:bg-surface"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Theme toggle + Avatar Menu */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-main hover:bg-surface/80 transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-gold-text" />
            ) : (
              <Moon className="w-4 h-4 text-muted" />
            )}
          </button>

          {/* Google 1-Click Sign In OR Authenticated Avatar Menu */}
          {!session.isAuthenticated ? (
            <button
              type="button"
              onClick={() => signInWithGoogle(location.pathname)}
              disabled={googleLoading}
              className="h-9 px-3 rounded-xl bg-surface border border-border hover:bg-input-box text-xs font-semibold text-main flex items-center gap-2 shadow-soft transition-all cursor-pointer disabled:opacity-60"
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
              <span>{googleLoading ? "Signing in…" : "Sign in"}</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-9 h-9 rounded-xl bg-input-box border border-input-border text-primary font-bold text-sm flex items-center justify-center hover:opacity-90 transition-all overflow-hidden cursor-pointer"
                aria-label="User menu"
              >
                {session?.user?.avatarUrl ? (
                  <img
                    src={session.user.avatarUrl}
                    alt={session.user.name || "User"}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : session?.user?.name ? (
                  session.user.name.charAt(0).toUpperCase()
                ) : (
                  "U"
                )}
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-12 w-52 bg-surface border border-border rounded-2xl shadow-elevated p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-border/60 mb-1">
                    <div className="text-sm font-semibold text-main truncate">
                      {session?.user?.name || "Google User"}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {session?.user?.email || "Signed in"}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-main hover:bg-input-box transition-colors text-left"
                  >
                    <SettingsIcon className="w-4 h-4 text-muted" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => openDemoMenu()}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gold-text hover:bg-gold-bg/30 transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Demo Controls</span>
                  </button>

                  <button
                    onClick={async () => {
                      await signOut();
                      logout();
                      navigate("/check");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left mt-1 border-t border-border/60"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
