import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Login } from "./pages/Login";
import { Check } from "./pages/Check";
import { Reveal } from "./pages/Reveal";
import { ResultBreakdown } from "./pages/ResultBreakdown";
import { ResultsList } from "./pages/ResultsList";
import { MyTickets } from "./pages/MyTickets";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { useAuthStore } from "./store/useAuthStore";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session } = useAuthStore();
  const location = useLocation();

  if (!session.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Auth-Guarded App Shell Routes */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
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
