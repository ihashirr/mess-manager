# Mess Manager 🍲

A focused, high-readability mobile app for home-based meal service operators. Replaces paper notebooks with a clean digital ledger for tracking customers, payments, and daily menus.

---

## ✨ Key Features

| Tab | Purpose |
| :--- | :--- |
| **Home** | Glanceable dashboard: active customers, payments due, meal counts |
| **Customers** | Enroll customers, set subscription dates & meal plans, delete records |
| **Payments** | One-tap "Mark Paid" flow with subscription renewal logic |
| **Finance** | Monthly income ledger with expected vs. collected tracking |
| **Menu** | Weekly Control Panel with live demand forecasts |

---

## 🛠️ Technical Stack

- **Framework**: React Native via [Expo](https://expo.dev)
- **Database**: Firebase Firestore (real-time `onSnapshot` listeners)
- **Architecture**: SSOT — derived logic only, no stored calculated fields
- **Currency**: DHS (UAE dirham), pricing tiers: 350 / 650 per month
- **Mock Mode**: Toggle `SETTINGS.USE_MOCKS` in `constants/Settings.ts` for offline dev

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase
# Add your credentials to firebase/config.ts

# 3. Start development server
npx expo start --clear
```

---

## 📂 Project Structure

```
app/
  index.tsx       — Home / Dashboard
  customers.tsx   — Customer management
  payments.tsx    — Payment recording
  finance.tsx     — Financial overview
  menu.tsx        — Daily menu editor
  _layout.tsx     — Tab navigation

components/ui/    — Atomic Layout Engine
  Card.tsx        — Content container
  Button.tsx      — Functional interactions
  Input.tsx       — High-readability fields
  Badge.tsx       — Status indicators
  Screen.tsx      — Layout frame
  ScreenHeader.tsx — Contextual header
  Section.tsx     — Structural grouping
  PrimaryPanel.tsx — High-contrast summary

firebase/
  config.ts       — Firestore initialization

utils/
  customerLogic.ts — Derived status, days left, due amount
  mockDb.ts        — In-memory mock state manager

mocks/
  customers.json  — Sample customer data
  payments.json   — Sample payment ledger

constants/
  Settings.ts     — USE_MOCKS toggle

TECHNICAL_LOGIC.md   — System architecture & data model
REDESIGN_LOG.md      — Development history & phase log
PRODUCTION_CLEANUP.md — Steps to ship to production
```

---

*Built for simplicity and ease of use. See `TECHNICAL_LOGIC.md` for architecture details.*
