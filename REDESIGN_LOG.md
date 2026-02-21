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
