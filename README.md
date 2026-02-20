# Mess Manager 🍲

Mess Manager is a simple, high-readability mobile application designed for home-based meal service operators. It replaces traditional paper notebooks with a direct, one-tap digital solution for tracking customers and payments.

## ✨ Key Features

- **Reassurance Dashboard**: Large, glanceable stats for active customers, pending payments, and daily meal counts.
- **Customer Management**: Add new customers and track their subscription days remaining.
- **Easy Payments**: A dedicated "Payments Due" list with a one-tap "Mark Paid" button.
- **Daily Menu**: Quickly view and edit daily lunch and dinner offerings.

## 🛠️ Technical Overview

- **Core**: Built with [Expo](https://expo.dev) and React Native.
- **Database**: Real-time persistence using **Firebase Firestore**.
- **Architecture**: Simple, independent data fetching per screen (no complex global state).
- **UX**: Designed for non-technical users with massive fonts and Urdu language cues on critical actions.

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase
Ensure your credentials are set up in `firebase/config.ts`.

### 3. Start Developing
```bash
npx expo start
```

## 📂 Project Structure
- `app/`: Contains the screen routes (index, customers, payments, menu).
- `firebase/`: Firebase configuration and initialization.
- `components/`: Reusable UI components.
- `TECHNICAL_LOGIC.md`: Detailed breakdown of system logic and data flow.

---
*Built for simplicity and ease of use.*
