# Technical Documentation - System Logic Overview

This document outlines the technical architecture, data flow, and specific logic implemented for each screen of the Mess Manager application.

## 📡 Data Persistence & Infrastructure

- **Firebase Firestore**: Used as the primary database.
- **Real-time Sync**: Every screen uses `onSnapshot` for immediate UI updates when the database changes (no manual "pull to refresh" needed).
- **Independent Fetching**: Screens fetch their own specific data subsets directly to avoid the complexity of a global state manager.

---

## 🏗️ Screen-by-Screen Logic

### 1. Home Screen (`index.tsx`)
**Purpose**: Reassurance and daily overview.
- **Fetch Logic**: Queries all documents in the `customers` collection.
- **Derived Stats**: 
  - `activeCount`: `daysLeft > 0`
  - `paymentsDue`: `paymentDue === true`
  - `lunchCount`: `plan` contains "Lunch"
  - `dinnerCount`: `plan` contains "Dinner"
- **UI Focus**: Ultra-large typography for high readability from a distance.

### 2. Customers Screen (`customers.tsx`)
**Purpose**: User management and enrollment.
- **Fetch Logic**: Queries Firestore for customers where `daysLeft > 0`.
- **Add Customer Feature**:
  - Uses a local `isAdding` toggle to show/hide a form.
  - **`handleAddCustomer`**: Validates input and uses `addDoc` to create a new record.
  - New customers default to `paymentDue: true` and start with 30 days by default.
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
- **State**: Uses local React `useState` (can be upgraded to Firestore persistence in the future).
- **Toggle Logic**: Switches between **View Mode** (large bold text) and **Edit Mode** (Input fields).
- **UI Focus**: Minimalist design using a settings icon (⚙) for navigation.

---

## 🛠️ Data Model (Firestore `customers` collection)

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | string | Customer's full name |
| `plan` | string | "Lunch", "Dinner", or "Lunch + Dinner" |
| `amount` | string | Fee amount (e.g., "2500") |
| `daysLeft` | number | Subscription days remaining |
| `paymentDue` | boolean | Flag for unpaid fees |

---

## 🎨 UI Philosophy
- **Comfortable Spacing**: Large cards and ample padding for non-technical users.
- **Visual Cues**: Usage of Red (`#d32f2f`) for warnings/days and Green (`#2e7d32`) for success/payments.
- **Language**: Strategic use of Urdu text on primary buttons for better accessibility.
