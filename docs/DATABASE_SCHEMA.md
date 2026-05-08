# 🗄️ Database Schema — Firestore Reference

This document defines the structure, data types, and relationships for the Mess Manager Firestore database.

---

## 📂 Collections Overview

| Collection | ID Strategy | Description |
| :--- | :--- | :--- |
| `customers` | Auto-generated | Master list of all enrolled customers. |
| `payments` | Auto-generated | Ledger of every payment transaction. |
| `expenses` | Auto-generated | Ledger of receipt-scanned or manually captured expense deductions. |
| `menu` | `YYYY-MM-DD` | Master menu configuration per day. |
| `attendance` | `YYYY-MM-DD_customerID` | Daily overrides for customer meal attendance. |

---

## 👤 Customers Collection
**Purpose**: Primary source of truth for subscription status and billing.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | Customer's full name. |
| `phone` | string | Contact number. |
| `address` | object | `{ location: string, flat: string }` — delivery details. |
| `pricePerMonth` | number | Calculated fee based on meal subscription (350 or 650). |
| `totalPaid` | number | Cumulative amount paid by the customer (cached total). |
| `startDate` | Timestamp | Date the subscription first started. |
| `endDate` | Timestamp | Current subscription expiration date. |
| `isActive` | boolean | Flag for "Soft Delete" logic. |
| `notes` | string | Optional administrative notes. |
| `mealsPerDay` | object | `{ lunch: boolean, dinner: boolean }` — subscription type. |

---

## 🍴 Menu Collection
**Purpose**: Weekly planning and production forecasting.
**Document ID**: Date string (e.g., `2026-02-25`).

| Field | Type | Description |
| :--- | :--- | :--- |
| `lunch` | object | `{ main: string, rice: { enabled: bool, type: string }, roti: bool, extra: string }` |
| `dinner` | object | Mirror structure of `lunch`. |
| `updatedAt` | string | ISO Timestamp of the last save. |

---

## 💰 Payments Collection
**Purpose**: Transaction audit trail for financial reporting.

| Field | Type | Description |
| :--- | :--- | :--- |
| `customerId` | string | Link to the `customers` document ID. |
| `customerName` | string | Denormalized name for readable history (audit trail). |
| `amount` | number | DHS amount of this specific payment. |
| `date` | Timestamp | Date/time the payment was recorded. |
| `method` | string | Payment method (`"cash"`, `"bank"`, etc.). |
| `monthTag` | string | `"YYYY-MM"` — used for monthly aggregation queries. |

---

## 🧾 Expenses Collection
**Purpose**: Expense ledger for receipt scanning and cashflow deductions.

| Field | Type | Description |
| :--- | :--- | :--- |
| `title` | string | Short operator-facing label for the receipt. |
| `merchantName` | string | Store or supplier name detected from the receipt. |
| `total` | number | Final payable total detected from the receipt. |
| `date` | Timestamp | Receipt date or save date fallback. |
| `monthTag` | string | `"YYYY-MM"` — used for monthly aggregation queries. |
| `currency` | string | Usually `DHS`. |
| `source` | string | `ocr_scanner` or future manual-entry source. |
| `note` | string | Optional scanner/operator note. |
| `confidence` | number | OCR confidence estimate between `0` and `1`. |
| `items` | array | Extracted line items: `{ name, amount, quantity }[]`. |
| `receiptDate` | string | Parsed receipt date in `YYYY-MM-DD` form. |
| `paymentMethod` | string | Parsed payment hint such as `Card` or `Cash`. |
| `rawText` | string | Full OCR text captured locally from the receipt image. |
| `imageUri` | string | Persisted local image URI used for OCR and later review. |
| `localReceiptId` | string | SQLite queue identifier used to dedupe local and synced receipt records. |

### Local Receipt Queue (SQLite)
**Purpose**: Offline-first staging area for receipt scans before Firestore sync.

Each queued record stores the same parsed expense payload plus:
- local queue `status` (`pending`, `failed`, `synced`)
- `syncError` for the last failed Firestore write
- `createdAt` / `updatedAt` timestamps for queue ordering and retry logic

### General Offline Cache + Sync Queue (SQLite)
**Purpose**: Keep the app readable and writable while offline, then reconcile local changes back to Firestore.

Local SQLite tables mirror the core live entities:
- `customers`
- `payments`
- `expenses`
- `menu_entries`
- `attendance_entries`

Each cached row stores:
- serialized document payload
- `dirty` flag for unsynced local edits
- `deleted` flag for optimistic local removals
- `updatedAt` for freshness and merge ordering

The shared `sync_queue` table stores:
- operation kind such as `customer_create`, `attendance_batch_upsert`, `menu_upsert`, `payment_record`, `payment_delete`, and `expense_delete`
- target entity id
- serialized mutation payload
- queue status (`pending` or `failed`)
- retry count and last error text
- human-readable title and subtitle used by the global queue inspector

---

## ✅ Attendance Collection
**Purpose**: Daily attendance overrides (default is "Present").
**Document ID**: Linked ID (`YYYY-MM-DD_customerID`).

| Field | Type | Description |
| :--- | :--- | :--- |
| `date` | string | `YYYY-MM-DD` string. |
| `customerId` | string | Link to the `customers` document ID. |
| `name` | string | Denormalized for quick list rendering. |
| `lunch` | boolean | `true` if attending, `false` if opted-out. |
| `dinner` | boolean | `true` if attending, `false` if opted-out. |

---

## 🔗 Relationships & Integrity

### 1. The Finance Bridge
The `Finance` screen joins `customers` (for **Expected Revenue**), `payments` (for **Collected Revenue**), and `expenses` (for **receipt deductions**). The `monthTag` in payment and expense docs allows for instant filtering without complex date-range logic.

### 2. The Attendance Proxy
The `Home` screen calculates plate counts by:
1. Fetching all `isActive` customers.
2. Checking for specific meal subscriptions (`mealsPerDay`).
3. Overriding counts with any explicit `attendance` records for that day.

### 3. Subscription Renewal Logic
When a payment is recorded, the `customers/{id}` record's `endDate` is pushed forward by 30 days from either `today` (if expired) or `currentEndDate` (if still active).
