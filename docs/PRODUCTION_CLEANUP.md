# 🚀 Production Cleanup Guide

When you are ready to publish the app and no longer need the "Mock Mode" feature, follow these steps to clean up the code.

## 1. The "Quick Switch"
If you just want to go live but **keep** the ability to test later, do only this:
- **File**: `constants/Settings.ts`
- **Action**: Change `USE_MOCKS: true` to `USE_MOCKS: false`.

---

## 2. Full Permanent Cleanup
If you want to completely remove the mock logic from your project, follow these steps:

### Files to Delete 🗑️
- [ ] Folder: `/mocks/` (Delete the whole folder and JSON files)
- [ ] File: `utils/mockDb.ts` (The mock state manager)
- [ ] File: `constants/Settings.ts`
- [ ] File: `docs/PRODUCTION_CLEANUP.md` (this file)

### Code to Remove ✂️
In `index.tsx`, `customers.tsx`, `payments.tsx`, and `menu.tsx`:

1.  **Remove Imports**:
    ```typescript
    import { SETTINGS } from '../constants/Settings';
    import mockCustomers from '../mocks/customers.json';
    ```

2.  **Remove the "If" Logic**:
    Delete this block from the `useEffect` in every page:
    ```typescript
    if (SETTINGS.USE_MOCKS) {
        // ... all the code inside this block ...
        return;
    }
    ```

## 🔐 Final Security Step
Before real users start using the app, go to your **Firebase Console** -> **Firestore** -> **Rules** and change your rules to prevent strangers from deleting your data. 

*Current (Test Mode):*
`allow read, write: if true;`

*Recommended (Basic):*
`allow read, write: if request.auth != null;` (If you add login later)
