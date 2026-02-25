# 🗄️ Database Schema — Firestore Reference

This document defines the structure, data types, and relationships for the Mess Manager Firestore database.

---

## 📂 Collections Overview

| Collection | ID Strategy | Description |
| :--- | :--- | :--- |
| `customers` | Auto-generated | Master list of all enrolled customers. |
| `payments` | Auto-generated | Ledger of every payment transaction. |
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
The `Finance` screen joins `customers` (for **Expected Revenue**) and `payments` (for **Collected Revenue**). The `monthTag` in payments allows for instant filtering without complex date-range logic.

### 2. The Attendance Proxy
The `Home` screen calculates plate counts by:
1. Fetching all `isActive` customers.
2. Checking for specific meal subscriptions (`mealsPerDay`).
3. Overriding counts with any explicit `attendance` records for that day.

### 3. Subscription Renewal Logic
When a payment is recorded, the `customers/{id}` record's `endDate` is pushed forward by 30 days from either `today` (if expired) or `currentEndDate` (if still active).
