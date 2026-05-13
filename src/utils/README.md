# Utilities

Utility modules are grouped by app domain:

- `customerLogic.ts` - derived customer status, due amount, and date conversion helpers.
- `menuLogic.ts` and `weekLogic.ts` - menu defaults, week/date helpers, and attendance date ranges.
- `receiptTypes.ts`, `receiptParser.ts`, `receiptScanner.ts`, and `receiptQueue.ts` - receipt OCR parsing, platform scanner entrypoints, and local receipt queue handling.
- `firestoreErrors.ts` - user-facing Firestore error messages.

Keep utility functions deterministic and UI-free. Shared domain types belong in `src/types`, while component props should stay beside the component that owns them.

