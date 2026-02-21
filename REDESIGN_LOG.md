# 🚀 Mess Manager - Professional Redesign Log
**Session Date: 21 Feb 2026**

## 🎯 Global Objective
Transform a basic payment tracker into a professional-grade subscription management system using **Derived Logic** and **Single Source of Truth (SSOT)** principles.

---

## 🛠️ Phase 1: Firestore Schema Redesign
Deleted brittle "shortcut" fields and implemented a transparent data model.
- **Removed**: `daysLeft`, `paymentDue`, `amount`.
- **Added**: `phone`, `pricePerMonth`, `startDate`, `endDate`, `totalPaid`, `notes`, `isActive`.
- **Logic Philosophy**: Store raw dates and amounts; calculate status in real-time.

## 🧠 Phase 2: Derived Logic Implementation
"Stored numbers rot. Derived numbers stay honest."
- **Utility Module**: Created `utils/customerLogic.ts` to centralize all business rules.
- **Dynamic Status**: 
    - `getDaysLeft`: Precisely calculated from `endDate`.
    - `getCustomerStatus`: Derived status labels (ACTIVE, EXPIRING SOON, EXPIRED).
    - `getDueAmount`: Live balance calculation (`pricePerMonth - totalPaid`).
- **Visual Cues**: Implemented orange and red color-coding based on live status.

## ⚡ Phase 3: Smart Payment Extension
Implemented high-end subscription renewal logic to prevent overlap bugs.
- **Renewal Math**:
    - If customer is **Expired**: Renewal starts from `Today + 30 days`.
    - If customer is **Active**: Renewal stacks as `Current End Date + 30 days`.
- **Financial Tracking**: `totalPaid += pricePerMonth` logic ensures cumulative payment history.

## 🍴 Phase 4: Global Menu Upgrade
Redesigned the daily menu system for scalability and cleanliness.
- **Date-Based Storage**: Every day's menu is stored as its own document using the ISO date (`YYYY-MM-DD`) as the ID.
- **SSOT Menu**: One global menu per day. Customer's `plan` ("lunch", "dinner", "both") determines what they see.
- **Menu Screen**: Completely redesigned `app/menu.tsx` to handle daily menu creation and fetching automatically.

---

### 5. Step 5: Subscription Type Refactor
- **[TECHNICAL_LOGIC.md](file:///c:/Users/ihash/Desktop/Hm/TECHNICAL_LOGIC.md)**: Replace `plan` string with `mealsPerDay: { lunch: boolean, dinner: boolean }`.
- **[mocks/customers.json](file:///c:/Users/ihash/Desktop/Hm/mocks/customers.json)**: Updated all mock records to use boolean meal flags.
- **[app/index.tsx](file:///c:/Users/ihash/Desktop/Hm/app/index.tsx)**: Updated stats logic to check `mealsPerDay` flags.
- **[app/customers.tsx](file:///c:/Users/ihash/Desktop/Hm/app/customers.tsx)**: 
    - Replaced segmented plan selector with independent Lunch/Dinner toggles.
    - Updated `handleAddCustomer` to save the new `mealsPerDay` object.
    - Updated list rendering to display multi-meal labels (e.g., "Lunch + Dinner").
- **[app/payments.tsx](file:///c:/Users/ihash/Desktop/Hm/app/payments.tsx)**: Updated `Payment` type.

### 7. Phase 7: Financial Dashboard Engine
Moved from simple cumulative tracking to a professional transaction ledger.
- **[payments](file:///c:/Users/ihash/Desktop/Hm/app/payments.tsx) Collection**: Created a new Firestore collection to store individual transactions (Amount, Date, Method, MonthTag).
- **Audit Ability**: Every payment now creates a permanent historical record instead of just incrementing a number.
- **Finance Dashboard**: Added a new tab (`app/finance.tsx`) that calculates:
    - **Expected Income**: Potential monthly revenue.
    - **Collected**: Real cash-in-hand for the current month.
    - **Outstanding**: The gap you need to close.
    - **Collection Progress**: A visual bar showing how close you are to your monthly goal.

## ✅ Final Verification Results
- [x] **Ledger Tracking**: Verified that clicking "PAID" creates a new entry in the `payments` collection.
- [x] **SSOT Finance**: Verified the dashboard accurately sums the ledger in real-time.
- [x] **Dynamic Date**: Verified the screen shows the current system date.

## 🇦🇪 Phase 8: Final Audit & Localization
Transitioned to full UAE market compliance.
- **Realistic Pricing**: Implemented automatic pricing tiers: 350 DHS for single meal, 650 DHS for both.
- **Currency Sync**: Replaced "Rs." with "DHS" across all screens and documentation.
- **Legacy Fallbacks**: Unified the stats logic to support older customers who still have the string-based `plan` field alongside the new boolean flags.

## 🧼 Phase 9: Finance Fixes & Data Cleanup
Refined the financial model and added management tools.
- **Per-Customer Outstanding**: Replaced simple subtraction (`Expected - Collected`) with a per-customer sum of actual remaining balances. This prevents negative numbers when collecting past debts.
- **Validation**: Added name validation to the "Add Customer" form to prevent nameless/ghost records.
- **Delete Feature**: Added a "DELETE" button to Customer cards to allow removing test data or abandoned subscriptions.
- **Mock State Manager**: Created `utils/mockDb.ts` to provide a synchronized in-memory database during mock sessions, ensuring cross-tab consistency.

## 🆔 Phase 11: Identity & Data Integrity
Ensured financial logic remains clean even when customers are deleted.
- **Orphan Filtering**: Finance dashboard now cross-references every payment with the current customer list. Payments from deleted customers are automatically excluded from "Collected" totals.
- **Ledger Transparency**: Orphaned transactions are flagged as "(Deleted Customer)" in the history list, allowing for easy manual audit and cleanup.
- **Strict ID Mapping**: Shifted from descriptive name-based tracking to strict ID-based relationships to prevent "name pollution".
