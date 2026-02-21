# 📌 Application Purpose — Agent Context

## What Mess Manager Is

Mess Manager is a single-user mobile app for a home-based meal service operator. It replaces a physical notebook with a digital ledger that's easy to read and use without technical knowledge.

## Core Scope

| In Scope | Out of Scope |
| :--- | :--- |
| Tracking active customers | Multi-user roles |
| Monitoring subscription days | Authentication system |
| Recording cash payments | Invoicing or reports |
| Daily menu management | Analytics dashboards |
| Monthly finance overview | Cloud functions / backend |

## Design Constraints

- **Single user only** — No login, no shared accounts
- **Minimal UI** — Large readable cards, one-tap actions, minimal typing
- **Derived logic** — All status (active, expiring, due) is calculated at runtime, never stored
- **Urdu-friendly** — Primary action buttons carry Urdu labels for the target user

## Currency & Pricing

- Currency: **DHS** (UAE Dirham)
- Standard pricing: **350 DHS** (single meal), **650 DHS** (lunch + dinner)

## Developer Notes

- Toggle `SETTINGS.USE_MOCKS` in `constants/Settings.ts` to switch between Firebase live data and a local mock session
- See `TECHNICAL_LOGIC.md` for data model and screen-by-screen logic
- See `REDESIGN_LOG.md` for full development history

This is not a SaaS product. It is a focused operational tool.