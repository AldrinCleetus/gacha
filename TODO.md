# Project Gacha — Roadmap & Tasks

> **Scheduled for Tomorrow**

---

## 1. Fix Pending Draw Status Handling
- [ ] **Context-Aware Draw Status Messaging**:
  - Differentiate clearly between draws that have not taken place yet (`status: "expected"`) vs draws currently being conducted (`status: "observed"` / in progress) vs published draws.
  - Replace generic "Results Pending / Better luck on the next draw" with an informative status card:
    - Expected draw date & scheduled draw time (15:00 IST).
    - Live countdown or status indicator ("Drawn today at 3:00 PM IST").
- [ ] **Draw Selector Visuals**:
  - Add clear status badges in the Scheduled Draw dropdown (`● Results Out`, `⏳ Awaiting Draw`, `🔍 Drawing Now`).
  - Prevent accidental checks against unpublished draws or show a clear prompt: *"Draw results will be announced at 3:00 PM IST. Check back then."*
- [ ] **Nudge & Live Notification**:
  - Provide a one-click *"Check Again"* or *"Notify me when results are out"* when viewing a pending draw.

---

## 2. Kerala-Style Theme & Subtle Background Motif on Landing Page
- [ ] **Aesthetic Background Motif**:
  - Integrate a subtle, high-taste Kerala-inspired background illustration or SVG watermark (e.g., subtle Kasavu gold accents, minimalist Kerala mural/boat race silhouette, organic Kerala foliage/palm patterns).
  - Ensure watermark is low opacity (subtle, non-distracting) so it doesn't reduce contrast or interfere with legibility.
- [ ] **Theme & Atmosphere**:
  - Harmonize with both dark and light modes.
  - Dynamic subtle glow based on the active scheme's theme colors (Bhagyathara purple, Win-Win emerald, Sthree Sakthi violet, Karunya ruby, etc.).

---

## 3. Fix & Upgrade Dashboard
- [ ] **Live Backend Analytics Integration**:
  - Ensure `UserStats` and history data seamlessly synchronize between local storage and live API endpoints.
  - Verify lifetime spend, lifetime winnings, net profit/loss (₹), and win rate (%) calculations.
- [ ] **Chart & Visual Polish**:
  - Fix Recharts `ResponsiveContainer` rendering and aspect ratios across mobile screens and desktop viewports.
  - Audit timeline line chart (cumulative P&L) and monthly bar charts for edge cases with few or many tickets.
  - Improve scheme breakdown visual list and longest dry-spell indicators.
- [ ] **Empty States & Onboarding**:
  - Polish the 0-tickets empty state with direct calls to action to test or verify tickets.
