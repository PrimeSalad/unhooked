@AGENTS.md

# Unhooked — project rules

AI-in-Health wellness app (Debt · Spend · Scroll) built around one loop:
**Trigger → AI Pause → Reflection → Recommendation → Decision.**

- **Work from [`plan.md`](./plan.md).** Pick the next unchecked task in the current phase, implement it, tick the box. Product spec and research live in `initalplan.md` (read-only).
- **Design for the primary persona** (plan.md → Target users): Ana, 24, BPO agent on a budget Android phone with OLA + BNPL debt. That means offline, private, discreet notifications, gentle tone, and a 15th/30th payday schedule.
- **Non-negotiables (plan.md §0):** real countdown in every pause; local-first data, no network calls without opt-in + disclosure; every AI/derived line labeled fact / estimate / suggestion via `CertaintyTag`; no shame language, no guarantees, the user always decides; crisis wording bypasses every model; no cloud AI (do not add one).
- **Where code goes:** routes in `src/app` stay thin; all math and rules in `src/domain` (pure TS, no React/Expo imports) with Jest tests; SQL in `src/db`; phrasing in `src/ai`. The AI never computes numbers — it phrases facts computed in `src/domain`.
- **Money is integer centavos** (`src/domain/money.ts`). Never store floats; format with `formatPHP` at the edge.
- **Log meaningful actions** with `logEvent` (`src/db/events.ts`). Insights and metrics read only the event log.
- **Schema changes:** append a new step in `src/db/migrations.ts` and bump `DATABASE_VERSION`; never edit a shipped step.
- **Stubs:** functions throwing `TODO(Pn)` and `it.todo` tests mark Phase *n* work — replace both together.
- **Help & Safety stays** (a hackathon requirement): `/help` lists the hotlines and report links in `src/constants/resources.ts`, one tap from Today, Debt and Settings. Keep it simple; do not remove it. Verify every resource and the crisis numbers used by Ask Ginto against official sources before demo (set `verifiedOn`).

## Commands
```bash
npm start            # Expo dev server (scan QR with Expo Go)
npm run check        # typecheck + lint + tests — must pass before done
npm test             # jest
npm run doctor       # expo-doctor
npx expo install <pkg>  # add deps (never plain npm install for Expo/RN packages)
```
