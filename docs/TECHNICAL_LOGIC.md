# Technical Documentation — System Logic Overview

This document covers the architecture, data model, and screen-by-screen logic for the Mess Manager application.

---

## 📡 Infrastructure

| Concern | Solution |
| :--- | :--- |
| **Database** | Firebase Firestore |
| **Real-time updates** | `onSnapshot` listeners — no manual refresh needed |
| **State** | Per-screen independent fetching, no global store |
| **Derived logic** | All status fields computed at runtime (never stored) |
| **Deadlines** | No cutoff — full editability for past and today's records |
| **Dev mode** | `SETTINGS.USE_MOCKS = true` uses `mockDb.ts` — no Firebase calls |

> "Stored numbers rot. Derived numbers stay honest."

---

## 🏗️ Screen-by-Screen Logic

### 1. Home Screen (`index.tsx`)
**Purpose**: Operational command center and daily production overview.
- **Segmented View**:
  - **DASHBOARD**: Shows totals (Derived from active customers + attendance overrides).
  - **ATTENDANCE**: Single-tap list to toggle who's eating today. Toggles show actual dish names.
- Subscribes to `customers` collection, `menu/{today}`, and `attendance/{today_*} docs`.
- **Total Meals Today**: Sum of Lunch/Dinner plates.
- **Logic Integrity**: 
    - **Subscription Locking**: Counts and toggles ignore customers not subscribed to a specific meal.
- **Admin Stats**: Compact side-by-side view for database overview.

### 2. Customers Screen (`customers.tsx`)
**Purpose**: Customer enrollment and management.
- Queries Firestore for `isActive == true` customers in real-time.
- **Add Customer**:
  - Requires non-empty name (validated on submit).
  - Auto-prices: 350 DHS (one meal), 650 DHS (both).
  - Saves `mealsPerDay: { lunch, dinner }`, `startDate`, `endDate`, `totalPaid: 0`.
- **Delete Customer**: `handleDeleteCustomer` calls `deleteDoc`. Removed from list immediately via `onSnapshot` reaction.
- Status badges: EXPIRED (red), EXPIRING SOON (orange), days remaining label.

### 3. Payments Screen (`payments.tsx`)
**Purpose**: Recording monthly payments.
- Lists active customers with a remaining balance (`totalPaid < pricePerMonth`).
- **Mark Paid** (`recordPayment`):
  - Updates `customers/{id}` with new `totalPaid` and extended `endDate`.
  - Creates a new document in `payments` collection (ledger entry).
  - Renewal logic: expired → `today + 30 days`; active → `endDate + 30 days`.

### 4. Menu Screen (`menu.tsx`)
**Purpose**: Operational master-plan for the week.
- **Structure**: Vertical scrollable list of all 7 days (Monday–Sunday).
- **Two Modes**:
    - **View Mode (Default)**: Visual checklist of "What we are cooking" with bold typography.
    - **Edit Mode (Gear)**: Reveals input fields and toggles for configuration.
- **Visual Dominance**: Today's card is highlighted using `surfaceElevated` (#1C2428) to stand out as the current focus.
- **Intelligence Layer**: Displays live **Production Forecasts** (Demand counts) under each day card, synced to customer/attendance data.
- **Sticky Save Bar**: Bottom bar appears for uncommitted changes allowing a single "SAVE WEEK" batch update.
- **Persistence**: Saves to `menu/{YYYY-MM-DD}` via individual day commits.

### 5. Attendance Logic
- **Storage**: `attendance/{YYYY-MM-DD}_{customerId}`.
- **Full Flexibility**: No 10 AM cutoff. Attendance can be toggled for current, past, and future dates without restriction.
- **Opt-out Model**: If no record exists, customer is counted as "Attending" (Default YES).
- **Hardened Filtering**: Toggles and counts are conditionally rendered based on `mealsPerDay` subscription flags. Unsubscribed meals are never counted or displayed.
- **Weekly Input**: Customers tab allows setting 7 days at once.
- **Daily Input**: Home screen (Attendance tab) allows quick toggling for today only.

### 5. Finance Screen (`finance.tsx`)
**Purpose**: Monthly financial health audit.
- Listens to `customers` (for Expected) and `payments` filtered by `monthTag == "YYYY-MM"`.
- **Derived Metrics**:
  - **Expected**: Sum of `pricePerMonth` for all active customers.
  - **Collected**: Sum of `amount` for payments in current month — **only from existing customers** (orphan-filtered by ID).
  - **Outstanding**: Per-customer `getDueAmount` sum (not `Expected − Collected`).
  - **Progress**: `min(100, collected/expected * 100)` — capped to prevent overflow.
- **Transaction History**: Lists all this month's payments, with orphaned ones grayed out and labeled "(Deleted Customer)".
- **Delete Transaction**: Calls `deleteDoc` on `payments/{id}` — dashboard updates instantly.

### 6. Mock Database (`utils/mockDb.ts`)
**Purpose**: Offline/demo mode with cross-tab synchronization.
- In-memory singleton seeded from `mocks/customers.json` and `mocks/payments.json`.
- `subscribe(listener)` — components register for updates, mimicking `onSnapshot`.
- Any action (add customer, record payment) calls `notify()` which fires all listeners.

---

## �️ Database Architecture
The system logic is built on a relational-lite Firestore model. For detailed field specifications, document IDs, and relationship logic, refer to:
👉 **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**

---

## 🏗️ UI Architecture (Layout Engine)

The application follows a formal Layout Engine model where screens are composed of a limited set of **UI Primitives** found in `components/ui/`.

| Priority | Primitive | Description |
| :--- | :--- | :--- |
| **Frame** | `Screen` | Handles safe-area, global padding, and scroll state. |
| **Surface** | `Card` | The primary content container. Supports `variant="elevated"` or `borderless`. |
| **Grouping** | `PrimaryPanel` | High-contrast container for top-of-screen summaries. |
| **Structure** | `Section` | Logical grouping for list content with Label tier headers. |
| **Actions** | `Button` | Standardized interaction point with Urdu/English support. |
| **Inputs** | `Input` | Floating-label compatible high-readability text fields. |

---

## 🎨 Visual Token System

### 1. Spacing Rhythm (Strict 4.0)
All vertical and horizontal gaps are derived from a 4-unit base.
- `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`, `massive: 40`.
- **Goal**: Predictable rhythm that eliminates "soft" or "floating" layouts.

### 2. Typography tiers
Text is categorized into 3 functional tiers:
- **Tier A (Answer)**: High-impact stats (`28px`-`40px`).
- **Tier B (Label)**: Structural headers and inputs (`14px`-`16px`).
- **Tier C (Detail)**: Metadata and auxiliary labels (`12px`).

### 3. Flat Modern Aesthetic (Elevation)
The app uses **Aesthetic Option A: Flat Modern** + **Deep Aqua Dark Mode**.
- **Shadows**: 0% usage. No `shadowColor` or `elevation` in the codebase.
- **Depth**: Conveyed via 1px `borderWidth` and surface layering.
- **Deep Aqua Foundation**: Backgrounds use **Deep Charcoal Blue** (#0F1416) for high focus.
- **Functional Accents**: Accents use **Dark Aqua** (#0F766E) for a mature, operational feel.

---

## 🎨 UI Philosophy

- **The Silent Interface**: Reduced cognitive load by removing decorative icons and collapsing secondary information (Progressive Disclosure).
- **One-tap actions**: Primary tasks (mark paid, add customer) require minimal inputs.
- **Floating UI**: Bottom navigation is a decoupled, floating dock with rounded corners, providing a modern, premium feel.
- **Icon Intelligence**: Icons are reserved strictly for **Actions** or to prevent **Text Ambiguity**.
- **Urdu labels**: Primary action buttons use Urdu text for native-language accessibility.

---

*For detailed data structures, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).*
