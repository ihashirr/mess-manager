# Technical Documentation - System Logic Overview

This document outlines the technical architecture, data flow, and specific logic implemented for each screen of the Mess Manager application.

## 📡 Data Persistence & Infrastructure

- **Firebase Firestore**: Used as the primary database.
- **Real-time Sync**: Every screen uses `onSnapshot` for immediate UI updates when the database changes (no manual "pull to refresh" needed).
- **Independent Fetching**: Screens fetch their own specific data subsets directly to avoid the complexity of a global state manager.
- **Derived Logic (SSOT)**: We never store values that can be calculated. Fields like `daysLeft`, `status`, and `dueAmount` are computed in real-time. "Stored numbers rot. Derived numbers stay honest."

---

## 🏗️ Screen-by-Screen Logic

### 1. Home Screen (`index.tsx`)
**Purpose**: Reassurance and daily overview.
- **Fetch Logic**: Queries all documents in the `customers` collection.
- **Derived Stats**: 
  - `activeCount`: Customers where `endDate >= today`
  - `paymentsDue`: Customers where `totalPaid < pricePerMonth`
  - `lunchCount`: Customers where `mealsPerDay.lunch` is true
  - `dinnerCount`: Customers where `mealsPerDay.dinner` is true
- **UI Focus**: Ultra-large typography for high readability from a distance.

### 2. Customers Screen (`customers.tsx`)
**Purpose**: User management and enrollment.
- **Fetch Logic**: Queries Firestore for customers where `daysLeft > 0`.
- **Add Customer Feature**:
  - Uses a local `isAdding` toggle to show/hide a form.
  - **Validation**: Requires a non-empty name to prevent ghost records.
  - **`handleAddCustomer`**: Automatically sets price based on meals (350/650 DHS).
- **Delete Customer**:
  - Implemented `handleDeleteCustomer` using `deleteDoc`.
  - UI includes a red "DELETE" button for data cleanup.
- **List Logic**: Displays Name, Plan, and remaining days. Remaining days are highlighted in red for urgency.

### 3. Payments Screen (`payments.tsx`)
**Purpose**: Transaction tracking.
- **Fetch Logic**: Queries Firestore for customers where `paymentDue === true`.
- **Mark Paid Feature**:
  - **`markAsPaid`**: Uses `updateDoc` to set the `paymentDue` field to `false` for a specific ID.
  - Immediate Feedback: The real-time listener removes the item from the list as soon as the DB update is confirmed.
- **UI Focus**: Large Green button with Urdu text ("PAID - وصول ہو گیا").

### 4. Menu Screen (`menu.tsx`)
**Purpose**: Daily operations communication.
- **Fetch Logic**: Queries the `menu` collection for the document corresponding to the current date (YYYY-MM-DD).
- **Plan Filtering**: Automatically displays only what is relevant to the viewer (usually for the owner to set, but logic supports plan-based filtering).
- **UI Focus**: Minimalist design using a settings icon (⚙) for configuration.

### 5. Finance Screen (`finance.tsx`)
**Purpose**: Financial audit and health check.
- **Fetch Logic**: 
  - Queries all `customers` to calculate "Expected Income".
  - Queries `payments` collection for the current month's transactions.
- **Derived Metrics**: 
  - **Expected**: Total potential monthly revenue.
  - **Collected**: Total cash received in the current month (ledger sum).
  - **Outstanding**: Sum of individual remaining balances for all active customers (preventing negative totals).
- **UI Focus**: Clean dashboard with progress indicators and high-level totals.

### 6. Mock Database Utility (`mockDb.ts`)
**Purpose**: High-fidelity demo and fast iteration.
- **Logic**: Provides a centralized, session-based in-memory singleton.
- **Subscription Model**: Screens can `subscribe` to mock data updates, ensuring that recording a payment in one tab immediately updates stats on the Home and Finance tabs even without Firebase.

---

## 🛠️ Data Model
### 👤 Customers Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | Customer's full name |
| `phone` | string | Contact number |
| `mealsPerDay` | object | `{ lunch: boolean, dinner: boolean }` |
| `pricePerMonth`| number | Monthly subscription fee |
| `startDate` | Timestamp | Subscription start date |
| `endDate` | Timestamp | Subscription end date |
| `totalPaid` | number | Total amount paid so far |
| `notes` | string | Additional information |
| `isActive` | boolean | Status flag |

### 🍴 Menu Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `date` | string | ISO Date string (YYYY-MM-DD) |
| `lunch` | string | Lunch menu items |
| `dinner` | string | Dinner menu items |

### 💰 Payments Collection
| Field | Type | Description |
| :--- | :--- | :--- |
| `customerId` | string | Reference to the customer |
| `customerName`| string | Denormalized name for history |
| `amount` | number | Transaction amount |
| `date` | Timestamp | Precision timing |
| `method` | string | "cash", "bank", or "other" |
| `monthTag` | string | Format: "YYYY-MM" (e.g., "2026-02") |

---

## 🎨 UI Philosophy
- **Comfortable Spacing**: Large cards and ample padding for non-technical users.
- **Visual Cues**: Usage of Red (`#d32f2f`) for warnings/days and Green (`#2e7d32`) for success/payments.
- **Language**: Strategic use of Urdu text on primary buttons for better accessibility.
