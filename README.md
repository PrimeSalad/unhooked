# Unhooked

**Pause. Understand. Decide.** — a private decision layer for **debt**, **spending**, and **screen time**, built for the AI in Health category.

Instead of only tracking problems after they happen, Unhooked steps in at the moment of a risky decision — borrowing, checking out, or doomscrolling — with a short real pause, a personalized reflection, and practical options. The user always makes the final call.

| Module       | What it does                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Debt**     | Track money owed and lent, partial payments, repayment plans, a harassment Evidence Pack (PDF export), and a pause before borrowing again. |
| **Spend**    | Affordability checks against your budget and repayments, BNPL true-cost calculator, checkout pause, 24-hour cooling period.                |
| **Scroll**   | Scroll sessions with gentle check-ins, break suggestions, and habit insights.                                                              |
| **Messages** | Private English/Taglish pressure detection and an Evidence Pack for screenshots and saved messages.                                        |

Everything is stored **on your phone** (SQLite). Unhooked is a self-help tool, not medical, legal, or financial advice.

## Local AI that changes the product

Unhooked does not use “AI” as a chat badge. Its core intervention works offline:

- **Ginto JITAI v1** is an explainable on-device model that combines repayment pressure, purchase impact, scroll overruns, and an optional wellbeing check-in. It ranks how much care a moment needs, shows the contributing factors, and changes the recommendation inside the real pause flow.
- **Ginto Message NB v1** is a compact English/Taglish statistical classifier for payment pressure, harassment, and suspicious payment requests. It runs beside exact safety rules so the app can catch paraphrases while still highlighting the words that triggered a warning.
- **Grounded local answers** use the user’s SQLite records and tested financial calculations. The language layer never invents money figures.

Every model result is marked as an estimate, explains its strongest signals, and keeps the final decision with the user. Model output appears where it can change a choice: inside **Pause**, **Ask Ginto**, and **Message Check**.

## Getting started

Requires Node 20+ and the **Expo Go** app on your phone.

```bash
npm install
npm start          # scan the QR code with Expo Go
```

| Script                            | Purpose                         |
| --------------------------------- | ------------------------------- |
| `npm run android` / `ios` / `web` | Start on a specific platform    |
| `npm run check`                   | Typecheck + lint + tests        |
| `npm test`                        | Unit tests (Jest)               |
| `npm run format`                  | Prettier                        |
| `npm run doctor`                  | `expo-doctor` dependency checks |

## App and website guards (Android)

Guards need native code, so they do not run in Expo Go. Build a development app on an Android phone:

```bash
npx expo run:android
```

Then open Scroll → Guards, pick apps or add websites, and allow Usage access and Display over other apps when asked. In Expo Go and on web you can still set up guards and preview the pause.

## Prototype

Tap through the app, meet the mascot Ginto, and see the brand board: **[Unhooked prototype canvas](https://claude.ai/artifact/VMcLVnPGSGS9xtLLjfquDw)** (source in `prototype/project/`).

## Project docs

- [`plan.md`](./plan.md) — architecture, phased build plan, demo script, definition of done
- [`initalplan.md`](./initalplan.md) — product spec and research brief
- [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) — rules for AI coding agents

## Stack

Expo SDK 57 · React Native · TypeScript · Expo Router · expo-sqlite · zustand · Jest
