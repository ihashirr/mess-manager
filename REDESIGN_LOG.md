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
