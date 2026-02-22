# 🚀 Mess Manager — Redesign & Development Log

**Session Date**: 21 Feb 2026

## 🎯 Global Objective
Transform a basic payment tracker into a professional-grade subscription management system using **Derived Logic** and **Single Source of Truth (SSOT)** principles.

---

## Phase 1 — Firestore Schema Redesign
Deleted brittle "shortcut" fields and implemented a transparent data model.
- **Removed**: `daysLeft`, `paymentDue`, `amount`.
- **Added**: `phone`, `pricePerMonth`, `startDate`, `endDate`, `totalPaid`, `notes`, `isActive`.
- **Philosophy**: Store raw dates and amounts; calculate status in real-time.

## Phase 2 — Derived Logic Implementation
*"Stored numbers rot. Derived numbers stay honest."*
- Created `utils/customerLogic.ts` as the central business logic module.
- `getDaysLeft`: Calculated from `endDate`.
- `getCustomerStatus`: Derived labels (ACTIVE, EXPIRING SOON, EXPIRED).
- `getDueAmount`: Live balance (`pricePerMonth - totalPaid`).
- Color-coded UI: orange for expiring, red for expired.

## Phase 3 — Smart Payment Extension
High-end subscription renewal logic to prevent date overlap bugs.
- **If Expired**: Renewal starts from `Today + 30 days`.
- **If Active**: Renewal stacks as `Current End Date + 30 days`.
- `totalPaid += pricePerMonth` ensures cumulative payment history.

## Phase 4 — Global Menu Upgrade
Redesigned the daily menu for scalability.
- Every day's menu is stored as a Firestore document with the ISO date (`YYYY-MM-DD`) as its ID.
- One global menu per day. Customer's meal flags determine what they receive.
- Fully redesigned `app/menu.tsx`.

## Phase 5 — Subscription Type Refactor
Replaced the string-based `plan` field with a structured boolean object.
- **Schema change**: `plan: string` → `mealsPerDay: { lunch: boolean, dinner: boolean }`
- Updated all mock data in `mocks/customers.json`.
- Updated meal count logic in `app/index.tsx`.
- Updated Customer form with independent Lunch/Dinner toggles.

## Phase 6 — Firebase Live Mode Integration
Connected all screens to Firebase Firestore.
- Implemented `onSnapshot` listeners across `index.tsx`, `customers.tsx`, `payments.tsx`, `menu.tsx`.
- Introduced `SETTINGS.USE_MOCKS` flag in `constants/Settings.ts` for dev/prod switching.
- Mock Mode guards prevent any Firebase writes when `USE_MOCKS=true`.

## Phase 7 — Financial Dashboard Engine
Moved from cumulative tracking to a professional transaction ledger.
- Created new `payments` Firestore collection for individual transactions.
- Each "Mark Paid" action creates a permanent, auditable record.
- New `app/finance.tsx` tab showing:
  - **Expected Income**: Potential monthly revenue.
  - **Collected**: Real cash received this month.
  - **Outstanding**: Remaining balance per customer.
  - **Collection Progress**: Visual progress bar.

## Phase 8 — Final Audit & UAE Localization
- Pricing tiers: 350 DHS (single meal), 650 DHS (both meals) — auto-selected by form.
- Replaced "Rs." with "DHS" across all screens and docs.
- Added legacy fallback support for old `plan` string records.
- Full consistency audit across Mock and Live modes.

## Phase 9 — Finance Fixes & Data Cleanup
- **Per-Customer Outstanding**: Changed from `Expected − Collected` to a sum of actual balances per customer. Prevents negative totals from bulk historical cash flow.
- **Name Validation**: Form requires a non-empty name — prevents ghost records.
- **Delete Feature**: Added "DELETE" button to Customer cards for easy cleanup.
- **Mock State Manager**: Created `utils/mockDb.ts` — synchronized in-memory store for cross-tab mock updates.

## Phase 10 — Transaction Auditing & UI Polish
- Added "Recent Transactions" list at the bottom of the Finance dashboard.
- Each transaction shows name, date, amount, and a **DELETE RECORD** button.
- Progress bar capped at 100% with a "Surplus" note if over-collected.

## Phase 11 — Identity & Data Integrity
- **Orphan Filtering**: Finance now cross-references every payment against the current customer list. Payments from deleted customers are excluded from "Collected" totals.
- **Orphan UI**: Deleted-customer transactions are grayed out and labeled "(Deleted Customer)" in the history list.
- **Strict ID Mapping**: All relationship logic uses Firestore document IDs, not descriptive names.

---

## ✅ Verification Status
- [x] Ledger tracking — "PAID" creates a new entry in `payments` collection.
- [x] SSOT Finance — Dashboard sums the ledger in real-time.
- [x] Orphan filtering — Deleted customer payments excluded from collected total.
- [x] Progress bar — Capped at 100%, surplus shown as text.
- [x] Delete Customer — Removes record from Firestore immediately.
- [x] Delete Transaction — Removes individual ledger entry from Firestore.

## Phase 12 — Daily Production Engine
The Home screen is now an operational command center, not just a stats dashboard.
- **Production Card**: Dark, high-contrast card at the top of the Home screen.
- **Lunch Count + Menu**: Shows how many lunch customers + what's on the menu today.
- **Dinner Count + Menu**: Shows how many dinner customers + what's on the menu tonight.
- **Total Meals Today**: Summed at the bottom of the card for at-a-glance production planning.
- **Live Menu Fetch**: `index.tsx` now subscribes to `menu/{today}` in Firestore, so the menu shown on Home always matches what was set on the Menu tab.
- **Admin Stats**: Moved Active Customers and Payments Due to a compact side-by-side layout below the production card.

## Phase 13 — Structured Menu Schema
Replaced flat blob strings with a structured per-category schema. The app now understands food components.
- **New Firestore schema**: `menu/{YYYY-MM-DD}.lunch` and `.dinner` are now objects `{ rice, roti, side }` instead of strings.
- **Menu tab**: 3 labelled inputs per meal (🍚 Rice, 🫓 Roti, 🥗 Side) — replaces single text blob.
- **Home screen**: Production cards now render each food component on its own row with emoji icons and the meal count badge.
- **Mock data**: `mocks/menu.json` updated to new schema.
- **Foundation for production math**: Rice vs roti counts can now be derived separately — future grocery intelligence engine basis.

## Phase 14 — Desi Mess Architecture (Cultural Correctness)
Refactored from western food-category model to desi kitchen reality model.
- **Main Salan is primary**: Every meal centers around one salan (the curry). Rice and roti are carriers, not dishes.
- **New schema**: `lunch: { main, rice: { enabled, type }, roti: boolean, extra }`
- **Menu tab**: Main salan gets a large top-level input. Roti and Rice are toggle switches. Rice type input appears only when rice is enabled.
- **Home screen**: Main salan rendered large. Roti and rice shown as human-readable chips ("Roti" / "No Roti", "Plain Rice" / "No Rice").
- **No booleans shown to users**: System resolves boolean to readable words before rendering.

## Phase 15 — Weekly Attendance Engine
Introduced a 3-layer operational system: weekly menu, customer attendance commitments, derived production counts.
- **`utils/weekLogic.ts`**: `getWeekId()` (ISO week), `getTodayName()`, `shortDay()`, `emptyWeekAttendance()` utilities.
- **Weekly Menu editor**: `menu.tsx` refactored to edit `weeklyMenu/{weekId}` docs. Day picker (Mon–Sun) with today highlighted. Save with Firestore `merge: true`.
- **Customer Attendance panel**: Each customer card in `customers.tsx` has a `📅 SET WEEK` button. Expands to show 7-day grid of Lunch/Dinner toggle chips. Saves to `customerSelections/{customerId}_{weekId}`.
- **Attendance-derived counts**: Home screen now derives `lunchCount`/`dinnerCount` from `customerSelections` docs, not from static `mealsPerDay` flags.
- **Opt-out model**: If a customer has no selection for this week, they are counted as attending (they pay regardless).
- **Backward compat**: Home screen falls back to old `menu/{today}` doc if `weeklyMenu` not yet set.

## Phase 16 — Brutal Simplicity (Date-Based Architecture)
Refactoring to remove overengineering. Storage moved from weekly abstractions to daily reality.
- **Flat Storage**: `menu/{date}` and `attendance/{date}_{customerId}`.
- **Home Screen Evolution**: Split into "Production Dashboard" (Stats) and "Daily Attendance" (Input).
- **Calendar-Based Input**: Users still see the Weekly Mon-Sun calendar for planning, but the database sees individual days.
- **Dish-Specific Toggles**: Attendance toggles now show the actual dish name (e.g., "Chicken Karahi (Lunch)") instead of generic flags.

## Phase 17 — Logic Integrity (Subscription Locking)
Hardened the app against data contamination by enforcing strict subscription rules.
- **Conditional Toggles**: Attendance switches on Home and Customers screens only appear if the customer has a paid plan for that meal (Lunch/Dinner).
- **Hardened Counts**: Production counts on the Dashboard now double-check subscription flags before adding a customer to the tally.

## Phase 18 — Deadline Logic (Freeze Rules)
Implemented "Operational Physics" to stop manual chaos during production.
- **10 AM Cutoff**: Today's attendance locks automatically at 10:00 AM (local time).
- **🔒 LOCKED UI**: Toggles become disabled and show a lock badge once the deadline passes or for past dates.

## Phase 19 — Vertical Week Control Panel
Transformed the Menu screen from individual tabs into a comprehensive weekly operational master view.
- **Whole-Week Visibility**: All 7 days (Monday–Sunday) appear in a single, vertical scrollable list.
- **Centralized Planning**: Operators can plan the entire week's logistics without screen-switching.

## Phase 20 — Not Set Warnings (Ambiguity Reduction)
Eliminated generic placeholders ("e.g. Chicken Karahi") that felt unfinished.
- **High Visibility**: Any unconfigured meal displays a bold, red **"⚠️ Not Set"** warning.
- **Clarity**: Applied both to the Menu planner and the Home dashboard cards.

## Phase 21 — Active Day Visual Dominance
Anchored the operator's attention to current production reality.
- **Today's Dark Mode**: The active day card features a high-contrast dark theme (#1a1a1a) with elevation and border highlights.
- **Visual Hierarchy**: Sunday (Today) looks like a "Current Active Task" compared to the rest of the week.

## Phase 22 — Production Forecasts (Intelligent Menu)
Tied menu planning directly to customer demand.
- **Live Forecasts**: Each day card in the Menu shows a "Demand: ☀️ X | 🌙 Y" tally.
- **Physics Check**: These counts come from live customer/attendance subscriptions, ensuring the operator knows exactly how much to cook while planning.

## Phase 23 — View/Edit Structural Split
Reduced UI noise by separating viewing from modification.
- **View Mode (Default)**: Clean typography, focused on "This is what we are cooking."
- **Edit Mode (Gear Icon)**: Reveals configuration fields (Inputs, Switches) only when active.

## Phase 24 — Smart Sticky Save Experience
Implemented a modern, centralized save pattern for the weekly master plan.
- **Sticky Bar**: A bottom bar appears ONLY when changes are uncommitted.
- **Batch Processing**: "SAVE WEEK" persists all modifications across the week in one transaction.

## Phase 25 — Ultra-Smart Bottom Navigation Overhaul
Redesigned the standard tab bar into a premium operational dock.
- **Floating Effect**: Implementing `position: 'absolute'` with rounded corners and high elevation to create a "floating dock" feel.
- **Icon Intelligence**: Every tab now features custom `MaterialCommunityIcons` with distinct active/inactive states.
- **Visual Depth**: Added shadows and optimized spacing for a ultra-smart, professional aesthetic that matches the new Menu panel.

## Phase 26 — Ultra-Smart Finance Dashboard Polish
Finalized the design system consistency across the operational suite.
- **Dark-Mode Header**: Implemented a bold, dark-themed summary header for the finance screen.
- **Elevated Metrics**: Metric cards now feature high-elevation, rounded corners, and color-coded accent borders.
- **Iconographic Context**: Added `MaterialCommunityIcons` to the header and transaction list for instant visual recognition of payment types.

## Phase 28 — Operation "Ideal Flow" (Menu Management)
Reconstructed the daily workflow for frictionless kitchen operations.
- **Smart Focus**: Automated auto-expansion and vertical anchoring for "Today's" card upon entry.
- **Cognitive Reduction**: Collapsed 6/7 days into "Ultra-Minimal" summaries (text-only dishes).
- **Bulk Productivity**: Introduced "Copy Today to Week" for instant 7-day planning.

## Phase 29 — Visual Synchronization (100% Vector Icons)
Standardized the visual language to eliminate platform fragmentation.
- **The Great Emoji Purge**: Replaced all hardcoded emojis (☀️, 🌙, 🍛, etc.) with `MaterialCommunityIcons`.
- **Consistency**: Guaranteed 1:1 visual parity between Android and iOS.
- **Premium Aesthetics**: Adopted high-resolution vectors for all actions (Locks, Checks, Forecasts).

## Phase 30 — UI Refinement (Header-Integrated Controls)
Optimized screen real estate by merging secondary actions into the primary header.
- **Save Migration**: Moved the "Save Week" functionality from a floating sticky bar to the Header.
- **Contextual Visibility**: The Save button appears only when changes exist, showing a "Modified Count" badge.
- **Zero Conflict**: Eliminated overlap between the save bar and the new premium navigation dock.

---

## ✅ Verification Status (Updated)
- [x] Vector Icon Parity — All screens use MaterialCommunityIcons exclusively.
- [x] Ideal Flow — Menu auto-focuses on Today with minimal distraction from other days.
- [x] Integrated Save — Header button performs batch persistence with real-time change tracking.
- [x] Nav Dock — Floating 3D dark-mode navigation with high-contrast active indicators.
