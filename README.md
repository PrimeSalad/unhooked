# Unhooked

**Pause. Understand. Decide.** — an AI-powered wellness assistant that helps people build healthier habits around **debt**, **spending**, and **screen time**, built for the AI in Health category.

Instead of only tracking problems after they happen, Unhooked steps in at the moment of a risky decision — borrowing, checking out, or doomscrolling — with a short real pause, a personalized reflection, and practical options. The user always makes the final call.

| Module | What it does |
|---|---|
| **Debt** | Track money owed and lent, partial payments, repayment plans, a harassment Evidence Pack (PDF export), and a pause before borrowing again. |
| **Spend** | Affordability checks against your budget and repayments, BNPL true-cost calculator, checkout pause, 24-hour cooling period. |
| **Scroll** | Scroll sessions with gentle check-ins, break suggestions, and habit insights. |
| **Safety** | Suspicious-message detector, verified Philippine support resources, and on-device privacy controls. |

Everything is stored **on your phone** (SQLite). Unhooked is a self-help tool, not medical, legal, or financial advice.

## Getting started

Requires Node 20+ and the **Expo Go** app on your phone.

```bash
npm install
npm start          # scan the QR code with Expo Go
```

| Script | Purpose |
|---|---|
| `npm run android` / `ios` / `web` | Start on a specific platform |
| `npm run check` | Typecheck + lint + tests |
| `npm test` | Unit tests (Jest) |
| `npm run format` | Prettier |
| `npm run doctor` | `expo-doctor` dependency checks |

## Project docs

- [`plan.md`](./plan.md) — architecture, phased build plan, demo script, definition of done
- [`initalplan.md`](./initalplan.md) — product spec and research brief
- [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) — rules for AI coding agents

## Stack

Expo SDK 57 · React Native · TypeScript · Expo Router · expo-sqlite · zustand · Jest
