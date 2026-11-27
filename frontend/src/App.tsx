import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { HandleSSOCallback } from "@clerk/react";
import { AppShell } from "./components/layout/AppShell";
import { ClerkAuthSync } from "./components/auth/ClerkAuthSync";
import { CocolotMark } from "./components/common/CocolotLogo";
import { Login } from "./pages/Login";
import { Check } from "./pages/Check";
import { ResultBreakdown } from "./pages/ResultBreakdown";
import { ResultsList } from "./pages/ResultsList";
import { MyTickets } from "./pages/MyTickets";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";

function SsoCallback() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-3">
      <CocolotMark className="w-10 h-10 animate-pulse" />
      <p className="text-xs font-medium text-muted">Completing Google sign-in…</p>
      <HandleSSOCallback
        navigateToApp={({ decorateUrl }) => {
          const destination = decorateUrl("/check");
          if (destination.startsWith("http")) {
            window.location.href = destination;
            return;
          }
          navigate(destination, { replace: true });
        }}
        navigateToSignIn={() => navigate("/login", { replace: true })}
        navigateToSignUp={() => navigate("/check", { replace: true })}
      />
    </div>
  );
}

export function App() {
  const hasClerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return (
    <BrowserRouter>
      {hasClerk && <ClerkAuthSync />}
      <Routes>
        {/* Minimal 1-Click Google Login & OAuth Callback */}
        <Route path="/login" element={<Login />} />
        <Route path="/sso-callback" element={<SsoCallback />} />

        {/* Guest-first App Shell Routes (Postgres sync activates when signed in) */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/check" replace />} />
          <Route path="check" element={<Check />} />
          <Route path="check/reveal" element={<Check initialChecking={true} />} />
          <Route path="results" element={<ResultsList />} />
          <Route path="results/:drawId" element={<ResultBreakdown />} />
          <Route path="tickets" element={<MyTickets />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/check" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
