import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Calendar, Ticket, BarChart3 } from "lucide-react";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: "/check", label: "Check", icon: Sparkles },
    { path: "/results", label: "Results", icon: Calendar },
    { path: "/tickets", label: "My Lotteries", icon: Ticket },
    { path: "/dashboard", label: "Dashboard", icon: BarChart3 },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-lg border-t border-border px-3 py-1.5 shadow-elevated safe-area-bottom">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === "/check" && location.pathname.startsWith("/check"));
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                isActive ? "text-primary font-bold" : "text-muted hover:text-main font-medium"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? "bg-primary-subtle scale-105" : "bg-transparent"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
