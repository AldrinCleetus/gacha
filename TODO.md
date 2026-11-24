# Project Gacha — Roadmap & Tasks

> **Status: All Scheduled Tasks Completed**

---

## 1. Fix Pending Draw Status Handling
- [x] **Context-Aware Draw Status Messaging**:
  - Differentiated between draws awaiting official publication vs published draws.
  - Replaced misleading "Better luck on the next draw / No prize this time" with a dedicated, informative pending state:
    - Amber status badge: `⏳ Results Awaiting Publication`.
    - Headline: `Results Not Published Yet`.
    - Detail: Explains that winning numbers are awaiting release by the Directorate of Kerala State Lotteries (announced at 3:00 PM IST).
- [x] **Draw Selector Visuals & Notices**:
  - Added clean status tags in the Scheduled Draw selector (`● Published` vs `⏳ Pending`).
  - Added an informative amber notice card on the input screen when an unpublished draw is selected.
  - Updated TicketGraphic to display `"Awaiting official draw numbers"` and `"Scheduled for Kerala Std Time 15:00"` with amber clock icons.
- [x] **Nudge & Live Refresh**:
  - Added one-click `"Refresh draw status"` button with animated loading indicator directly on the verdict card to check for newly published results.

---

## 2. Kerala-Style Theme & Subtle Background Motif on Landing Page
- [x] **Aesthetic Background Motif (`KeralaBackground.tsx`)**:
  - Created dedicated vector background component featuring:
    - Sweeping prow silhouette of the iconic Kerala *Chundan Vallam* (Snake Boat / Vallam Kali).
    - Gentle water ripples inspired by the Vembanad backwaters.
    - Graceful curved coconut palm fronds (*Thengu*) framing the top right.
    - Traditional Kerala wooden temple gable (*Charupadi*) arch lines.
    - Subtle *Kasavu* gold zari diamond ornament accents.
  - Set at an ultra-subtle opacity (`0.04` - `0.10`) ensuring high text contrast and zero legibility impact.
- [x] **Theme & Atmosphere**:
  - Fully responsive and harmonized across both dark and light modes.
  - Integrated dynamic scheme-adaptive radial ambient glow that smoothly adapts to the active lottery scheme's primary brand color (Win-Win emerald, Bhagyathara amethyst/purple, Sthree Sakthi violet, Karunya ruby, etc.).

---

## 3. Fix & Upgrade Dashboard
- [x] **Live Backend Analytics Integration**:
  - Updated `getStats()` to correctly calculate lifetime spend, winnings, net P&L, win rate, and dry spells.
  - Handled zero-ticket initialization cleanly (`mostCheckedScheme: "None"`).
- [x] **Chart & Visual Polish**:
  - Added `min-w-0` and `minHeight={240}` to chart containers preventing Recharts flex collapse on mobile.
  - Formatted Y-axis with clean currency values (`₹5k`, `₹10k`, etc.).
  - Bulletproofed chronological X-axis date parsing avoiding `undefined/undefined` labels.
  - Fixed Net Profit/Loss headline formatting (proper `+ ₹`, `- ₹`, and `₹0` styling).
  - Sorted scheme breakdown by ticket count descending so the user's most active lottery is highlighted first.
- [x] **Empty States & Onboarding**:
  - Polished empty state with direct calls to action to test or verify tickets.
