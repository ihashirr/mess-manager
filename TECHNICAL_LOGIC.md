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
| **Dev mode** | `SETTINGS.USE_MOCKS = true` uses `mockDb.ts` — no Firebase calls |

> "Stored numbers rot. Derived numbers stay honest."

---

## 🏗️ Screen-by-Screen Logic

### 1. Home Screen (`index.tsx`)
**Purpose**: Reassurance and daily overview.
- Queries all `customers` where `isActive == true`.
- Derived stats:
  - `activeCount`: Customers where `endDate >= today`
  - `paymentsDue`: Customers where `totalPaid < pricePerMonth`
  - `lunchCount`: Customers where `mealsPerDay.lunch == true`
  - `dinnerCount`: Customers where `mealsPerDay.dinner == true`
- Legacy fallback: supports old `plan` string field for backward compatibility.

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
**Purpose**: Daily operations communication.
- Queries `menu/{YYYY-MM-DD}` for today's doc. Creates it if missing.
- One global menu per day with `lunch` and `dinner` string fields.

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

## 🛠️ Data Model

### 👤 Customers Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | Customer's full name |
| `phone` | string | Contact number |
| `mealsPerDay` | `{lunch: bool, dinner: bool}` | Meal subscription type |
| `pricePerMonth` | number | Monthly fee (DHS) |
| `startDate` | Timestamp | Subscription start |
| `endDate` | Timestamp | Subscription end |
| `totalPaid` | number | Cumulative payments received |
| `notes` | string | Optional notes |
| `isActive` | boolean | Soft-delete flag |

### 🍴 Menu Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `date` | string | ISO date string used as document ID (`YYYY-MM-DD`) |
| `lunch` | string | Lunch menu items |
| `dinner` | string | Dinner menu items |

### 💰 Payments Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `customerId` | string | Firestore ID of the customer (primary relationship key) |
| `customerName` | string | Denormalized for readable history |
| `amount` | number | Payment amount (DHS) |
| `date` | Timestamp | Date/time of payment |
| `method` | string | `"cash"`, `"bank"`, or `"other"` |
| `monthTag` | string | `"YYYY-MM"` — used to filter current-month payments |

---

## 🎨 UI Philosophy

- **Large fonts**: Cards and stats optimized for readability at arm's length.
- **Color language**: Red `#d32f2f` = warning/due. Green `#2e7d32` = success/paid.
- **Urdu labels**: Primary action buttons use Urdu text for native-language accessibility.
- **One-tap actions**: Primary tasks (mark paid, add customer) require minimal inputs.
