# Unhooked — Build Plan

> **Pause. Understand. Decide.** An AI-in-Health wellness assistant for debt, spending, and doomscrolling.
> Source spec: [`initalplan.md`](./initalplan.md) · Agent rules: [`CLAUDE.md`](./CLAUDE.md)

**Status:** Phase 0 (boilerplate) ✅ done · Phase 1 next
**Goal:** a hackathon-ready MVP that reliably demos the **Trigger → AI Pause → Reflection → Recommendation → Decision** loop across Debt, Spend and Scroll, running fully offline on the phone.

---

## Target users

**Primary:** Filipino adults aged **18–35** on a monthly salary or allowance, using an **Android phone**, who are juggling online loans and/or BNPL installments, scroll several hours a day, and feel stressed about money but are **unlikely to seek professional help** (only 2.2–17.5% of Filipinos with mental health problems do, mainly because of cost and stigma).

**Segments**

| Segment | Who | Pain | Main modules |
|---|---|---|---|
| **OLA borrowers** | Borrowers from online lending apps, often several at once | Overlapping due dates, re-borrowing to pay old loans, harassment and contact-shaming (47,446 PAOCC complaints, Aug 2024–Jan 2026) | Debt tracker, borrowing pause, Evidence Pack, message detector |
| **BNPL / online shoppers** | Weekly online shoppers (56.4% of Filipinos) using SPayLater, GGives, Home Credit, etc. | Only see the small installment; the average BNPL purchase is ≈ 42% of monthly income | Affordability check, BNPL calculator, checkout pause, 24h cooling |
| **Heavy scrollers** | Students and young workers on TikTok, Facebook, Instagram, YouTube (PH ≈ 4.8 h/day on social media) | Late-night doomscrolling hurts sleep and focus; hard blocks feel punishing | Scroll sessions, gentle check-ins, break suggestions |
| **Informal lenders** | People who lend to friends and family | Forget who owes what; awkward to ask for repayment | "Owed to me" tracker, polite reminder drafts |

**Personas** (assumptions; validate with 3–5 quick user interviews before the pitch)

1. **Ana, 24, BPO agent, Pasig — primary persona and demo user.** Earns about ₱22,000/month, paid on the 15th and 30th. Has 3 OLA loans and 2 SPayLater plans. Gets threatening texts from a collector and has screenshots scattered in her gallery. Scrolls TikTok after her night shift. Wants to get out of debt without anyone finding out. *The demo script (§5) follows Ana.*
2. **Migs, 29, freelance designer, Cebu.** Irregular income, shops on Lazada and Shopee every week, and treats installments as "affordable." Needs: the true total cost and a reason to wait.
3. **Bea, 20, college student, Quezon City.** Gets a ₱5,000/month allowance. Loses 3–4 hours a night to scrolling and wants to keep using social media, just more intentionally. Needs: gentle, non-judgmental check-ins.
4. **Tita Lorna, 45, sari-sari store owner, Batangas.** Secondary user. Lends small amounts to relatives and neighbors and loses track of them. Needs: a simple "owed to me" list and polite reminders.

**Design implications**

- **Low-end Android and prepaid data** → offline-first, small bundle, no required account or login, test on a budget Android phone.
- **Privacy and shame** → no sign-up, on-device storage, discreet app name and notification text (never "You have debt!" on the lock screen).
- **Paid twice a month** → the budget supports a 15th/30th payday schedule, not only monthly.
- **Plain language, Taglish-friendly** → short sentences now; full Filipino/Taglish copy in Phase 7.
- **Stress** → gentle tone, no red alarm UI for user setbacks (red is reserved for high-risk messages).

**Not for:** people in an acute mental health crisis (route them to NCMH 1553 and emergency services via Help & Safety), or anyone who needs professional legal, medical or financial advice. Unhooked is a first step, not treatment.

---

## 0. North star & non-negotiables

These come straight from the research brief. Every phase must respect them. A feature that breaks one is not done.

| # | Rule | Why (evidence) | How it shows up in code |
|---|------|----------------|-------------------------|
| R1 | **The pause is a real delay**, not just a message. | PNAS *one sec* study: the delay drove the 57% reduction; a message alone did not. | `PauseCountdown` blocks the decision buttons for `settings.pauseSeconds` (default 10s). |
| R2 | **Local-first.** Sensitive data never leaves the device by default. | Data Privacy Act 2012 treats health info as sensitive personal info; stigma blocks help-seeking. | SQLite on device (`src/db`). Cloud AI is opt-in, disclosed, and Phase 7 only. |
| R3 | **Label everything**: fact vs. estimate vs. suggestion. | Responsible AI section; estimates must not look like facts. | Every AI/derived line is a `LabeledLine` and renders a `<CertaintyTag>`. |
| R4 | **No shame, no guarantees, user decides.** | Responsible AI section. | Copy review checklist (§7). The "Continue" option is always available. |
| R5 | **Help is one tap away.** | Every pause card links to professional help (NCMH). | Pause screen + Today screen link to `/help`. |
| R6 | **Pure logic is tested.** The AI never does math. | Trustworthy numbers in a money app. | All calculations live in `src/domain/*` with Jest tests; AI only phrases pre-computed facts. |

---

## 1. Tech stack (decided)

| Concern | Choice | Notes |
|---|---|---|
| App | **Expo SDK 57**, React Native 0.86, React 19, TypeScript (strict + `noUncheckedIndexedAccess`) | Runs in Expo Go for the demo; EAS for builds. |
| Navigation | **Expo Router** (file-based, typed routes) in `src/app` | JS `Tabs` (native tabs are still `unstable-` in SDK 57). |
| Storage | **expo-sqlite** (records) + `expo-sqlite/kv-store` (settings via zustand `persist`) | Versioned migrations via `PRAGMA user_version`. |
| State | **zustand** for UI/preferences only | Records are read from SQLite, not mirrored in a store. |
| AI | `ReflectionProvider` interface → **local template provider** (default) | Optional cloud provider via a server proxy in Phase 7. |
| Device | expo-notifications (local), expo-image-picker, expo-file-system, expo-print + expo-sharing (Evidence PDF), expo-haptics, expo-crypto (UUIDs) | All available in Expo Go. |
| Quality | Jest (`jest-expo`) + Testing Library, ESLint (`eslint-config-expo`), Prettier, `expo-doctor` | `npm run check` = typecheck + lint + tests. |

---

## 2. Architecture

```
src/
  app/                    ← routes only (Expo Router). Thin: compose components, call hooks.
    _layout.tsx           ← SQLiteProvider (+migrations) + root Stack
    (tabs)/               ← Today · Debt · Spend · Scroll · Insights
    pause.tsx             ← ★ AI Pause (full-screen modal, ?kind=borrow|checkout|scroll)
    check-in.tsx          ← wellness check-in (modal)
    message-check.tsx     ← suspicious message detector
    help.tsx              ← Help & Safety directory
    settings.tsx          ← privacy controls, delete-all-data
  components/             ← UI. ui.tsx = design-system primitives (Screen, Card, Button, CertaintyTag…)
  constants/              ← theme tokens, verified support resources + disclaimer
  domain/                 ← PURE TS: types, money, bnpl, affordability, repayment, scroll, messageRisk (+ __tests__)
  db/                     ← migrations, event log, repositories (one file per table)
  ai/                     ← ReflectionProvider interface, local provider, templates, insights
  store/                  ← zustand: settings (budget, limits, pause length, cloud opt-in)
  lib/                    ← notifications, evidence export, haptics wrappers  (create as needed)
```

**Data flow for every intervention**

```
Trigger (button / timer / 24h reminder)
  → domain/* computes facts (numbers, conflicts)          ← tested, deterministic
  → ai.reflect({ kind, facts, latestCheckIn })           ← phrasing only, labeled lines
  → /pause shows countdown (R1) → reflection → options
  → decision → db.logEvent('pause_decision', …)          ← feeds Insights + metrics
```

**Conventions**
- Money is **integer centavos** everywhere (`src/domain/money.ts`). Format only at the edge with `formatPHP`.
- Dates are ISO strings in UTC in the DB; format in local time in the UI.
- Every user action that matters calls `logEvent` (see `AppEventType` in `src/domain/types.ts`). Insights and success metrics read **only** the event log.
- Stubs throw `TODO(Pn)` errors and tests are `it.todo` — replace both when implementing phase *n*.

---

## 3. Phases

Each phase ends with: `npm run check` green, the feature demo-able in Expo Go, and its tasks ticked here.
Estimates assume a 2–3 person hackathon team; phases 2–4 can run in parallel after Phase 1.

### Phase 0 — Boilerplate ✅
- [x] Expo SDK 57 + TypeScript strict + Expo Router (tabs + modals), `@/*` path alias
- [x] SQLite provider with v1 schema (debts, payments, evidence, purchases, scroll_sessions, checkins, events)
- [x] Event log helper, settings store (persisted), theme tokens, UI primitives, `CertaintyTag`
- [x] Domain stubs with typed signatures + `it.todo` test specs; money helpers implemented + tested
- [x] Help & Safety screen, delete-all-data control, privacy copy
- [x] Jest, ESLint, Prettier, expo-doctor (21/21), Android bundle export verified

### Phase 1 — The AI Pause (core loop) ★ highest priority
The one screen that must be flawless; every module reuses it.
- [ ] `src/components/pause/PauseCountdown.tsx` — animated ring, `settings.pauseSeconds`, decision buttons disabled until it ends (R1). Haptic tick on finish.
- [ ] `src/components/pause/ReflectionCard.tsx` — headline + labeled lines + suggestions with `CertaintyTag` (R3).
- [ ] `src/app/pause.tsx` — accept `kind` + serialized `facts` params; call `getReflectionProvider().reflect()`; render options per kind:
  - borrow → *Review my obligations* · *Adjust amount* · *Continue anyway*
  - checkout → *Save for 24h* · *See cheaper option* · *Buy anyway*
  - scroll → *I'm using this intentionally* · *Take a break* · *Remind me later*
- [ ] Always-visible "Need to talk to someone?" link → `/help` (R5).
- [ ] Log `pause_shown` and `pause_decision { kind, decision, secondsViewed }`.
- [ ] `src/ai/templates.ts` — template tables per `PauseKind × Tone`; `localProvider` fills them from `facts`. Tests for: no shame words, every number comes from `facts`, gentle tone when stress/fatigue ≥ 4.

**Done when:** each tab's trigger button opens a pause, countdown blocks decisions, decision is in the `events` table.

### Phase 2 — Debt
- [ ] `src/db/debts.ts` repository: create/list/close debts, add payments, list with balances.
- [ ] Implement `domain/repayment.ts` (`balances`, `planRepayment`: due-date / avalanche / snowball, unrealistic-plan warning) + replace `it.todo`s.
- [ ] Debt tab: segmented **I owe / Owed to me** list, outstanding total, next due date; add-debt form; record partial payment.
- [ ] Repayment planner screen: budget input → ordered plan, months-to-clear, warning (labeled *estimate*).
- [ ] Money owed to you: "Draft a polite reminder" (template, copy to clipboard/share).
- [ ] Repayment reminders: local notification the day before `dueDate`.
- [ ] **Debt Evidence Pack**: pick screenshots (`expo-image-picker`) → copy into app document dir → tag lender + incident date + note → list grouped by lender/date → **Export PDF** (`expo-print` → `expo-sharing`). Include a cover page with dates and a disclaimer.
- [ ] **Borrowing pause**: "I'm thinking of borrowing" → amount input → facts = upcoming repayments this month, remaining budget → `/pause?kind=borrow`.
- [ ] `deleteAllData` also deletes evidence image files.

**Done when:** demo script steps D1–D3 (§5) work end to end.

### Phase 3 — Spend
- [ ] Budget onboarding (monthly income, fixed bills, savings goal, pay schedule: monthly **or 15th/30th**) → `settings.budget`. Change `BudgetProfile.payday` to support twice-monthly pay (persona Ana).
- [ ] Implement `domain/affordability.ts` + `domain/bnpl.ts` + tests (including the ₱4,500 demo case).
- [ ] `src/db/purchases.ts` repository.
- [ ] Purchase planner form: item, price, need/want, planned date, optional cheaper alternative.
- [ ] Affordability result card: verdict, remaining after purchase, conflicts with upcoming repayments (pull from Debt), all labeled *estimate*.
- [ ] BNPL calculator screen: total repayment vs. upfront, extra cost ₱ and %, "adds ₱X/month to your obligations".
- [ ] Checkout pause → options; **Save for 24h** sets `cooling_until`, schedules a local notification, logs `purchase_saved_for_later`.
- [ ] Cooling list: countdown per item; when due, re-run affordability and ask "Still want it?" (bought / skipped).

**Done when:** the full §5 user journey (S1–S5) runs without touching code.

### Phase 4 — Scroll
- [ ] Implement `domain/scroll.ts` + tests.
- [ ] App picker (Facebook, TikTok, Instagram, YouTube, X, custom) + per-session limit (default `settings.scrollLimitMinutes`).
- [ ] Session runner: start → timer → local notification at the limit (works when the app is backgrounded) → opens `/pause?kind=scroll`.
- [ ] Manual entry fallback ("I scrolled 45 min on TikTok last night").
- [ ] Break suggestions (walk, stretch, water, unfinished task, offline activity) — rotate, never repeat twice in a row; log `break_taken`.
- [ ] Habit insights: longest sessions, time-of-day histogram, breaks taken this week.
- [ ] Honest copy: "Unhooked can't see other apps automatically yet — start a session when you open one."

### Phase 5 — Insights, Today dashboard, Wellness check-in
- [ ] Check-in modal (stress / mood / fatigue, 1–5, optional) → `checkins` table; latest check-in feeds `PauseContext.latestCheckIn` → tone.
- [ ] `src/ai/insights.ts`: rule-based insight generators over the event log (≥ 1 per module + daily summary), each labeled; dismiss → `insight_dismissed`, don't show again for 7 days.
- [ ] Today screen: encouraging summary sentence, counts (pauses, purchases reviewed, breaks), upcoming repayment, cooling items, one top insight, quick actions.
- [ ] Insights tab: list + weekly progress summary.
- [ ] Copy pass against R4 (no guilt on setbacks).

### Phase 6 — Safety: message detector, Help & Safety, privacy
- [ ] Implement `domain/messageRisk.ts` (transparent keyword/regex rules in English + Filipino/Taglish: threats, urgency, contact-shaming, exposure of personal info, fake payment links/e-wallet numbers) + tests.
- [ ] Message check screen: paste → risk level + highlighted signals + explanation ("an indication, not proof") → **Save to Evidence Pack** · how to block/report.
- [ ] **Verify every entry in `src/constants/resources.ts` against the official source** and set `verifiedOn`. Do not demo with unverified numbers.
- [ ] Settings: what's stored, where, how to delete; cloud AI toggle (disabled until Phase 7) with disclosure text.
- [ ] Onboarding (3 screens): what Unhooked is / isn't (disclaimer), privacy promise, optional budget.

### Phase 7 — Stretch (only after Phases 1–6 demo cleanly)
- [ ] **Cloud reflections (opt-in):** tiny proxy (e.g. Cloudflare Worker / Vercel function) holding the Anthropic API key; app sends only the pre-computed `facts` (no names, no message text). Use the official `@anthropic-ai/sdk` on the server, model `claude-opus-5-5`, low effort, structured output matching `Reflection`. Fall back to `localProvider` on any error/offline. Show a disclosure before first use (R2).
- [ ] Android usage-stats integration via a dev build (config plugin) for automatic scroll detection.
- [ ] Filipino / Taglish copy.
- [ ] Dark mode (tokens are ready; add a dark palette).

### Explicitly deferred (from spec §18)
Automatic detection across every app · background monitoring needing unsupported permissions · SMS/call interception · predictive behavioral models · bank integrations · automated repayment/collection · claims of definitive fraud detection.

---

## 4. Research → feature traceability (for judges)

| Evidence | Feature |
|---|---|
| Debt ↔ depression OR 2.77 (Richardson meta-analysis); 47,446 PAOCC lending-app complaints | Debt tracker, repayment planner, Evidence Pack, borrowing pause |
| BNPL users with depression symptoms 1.91× odds (JAMA Health Forum); avg BNPL purchase ≈ 42% of monthly income (PH) | BNPL true-cost calculator, affordability check, 24h cooling |
| Problematic social media use ↔ depression r=0.27, anxiety r=0.35 | Pattern-based scroll check-ins (not hard blocks) |
| *one sec* PNAS: −57% app opens, delay is the active ingredient; CHI 2024 long-term friction | Real countdown in every pause (R1) |
| JITAI meta-analyses (g=0.77 behavior; g=0.15 mental health) | Triggers fire at the moment of decision, not on a fixed schedule |
| 0.6 psychiatrists / 100k; help-seeking 2.2–17.5%; DPA 2012 | Local-first AI, Help & Safety always one tap away |

---

## 5. Demo script (target: 3 minutes)

1. **Today** — "You reviewed two purchases and took a break from scrolling today." (seed data)
2. **Spend (S1–S5)** — enter ₱4,500 item → affordability shows ₱3,000 repayment conflict (*estimate*) → checkout pause, 10s countdown → reflection → *Save for 24h* → appears in cooling list.
3. **BNPL** — ₱4,500 as 6 × ₱899 + ₱150 fee → shows total and extra cost.
4. **Debt (D1–D3)** — "I'm thinking of borrowing ₱2,000" → borrow pause shows upcoming obligations → *Review my obligations*.
5. **Message check** — paste "PAY NOW OR WE WILL CONTACT YOUR FAMILY AND POST YOUR INFORMATION." → **High** with signals → *Save to Evidence Pack* → export PDF.
6. **Scroll** — start a 1-minute demo session → notification → gentle check-in → *Take a break*.
7. **Insights + Help** — daily summary updates; Help & Safety (NCMH) one tap away; "all of this stayed on your phone."

- [ ] `src/db/seed.ts` + hidden "Load demo data" action in Settings (dev only).
- [ ] Rehearse on a real Android phone in Expo Go, airplane mode on.

---

## 6. Success metrics (from the event log)

Debts & repayments recorded · repayment plans viewed · purchases evaluated · purchases saved for later · BNPL calculations · scroll check-ins answered · breaks taken · insight dismissals (proxy for usefulness).
These measure **engagement**, not health outcomes — say so in the pitch.

---

## 7. Definition of done (every PR)

- [ ] `npm run check` passes (typecheck, lint, tests); `npm run doctor` clean.
- [ ] New logic is in `src/domain` with tests; screens stay thin.
- [ ] Every generated line is labeled (R3); copy has no shame words, no guarantees (R4).
- [ ] Meaningful actions call `logEvent`.
- [ ] No new network calls without disclosure + opt-in (R2).
- [ ] Works on Android in Expo Go; tap targets ≥ 48dp; text readable at large font sizes.

## 8. Risks

| Risk | Mitigation |
|---|---|
| OS won't let us detect scrolling in other apps | Manual sessions + notifications; say so honestly; usage-stats is a stretch goal. |
| AI text sounds preachy or overconfident | Template-based local provider; copy checklist; `CertaintyTag` everywhere. |
| Wrong hotline numbers in a crisis | `verifiedOn` field; Phase 6 verification task blocks the demo. |
| Notification behavior differs in Expo Go | Test local notifications early in Phase 3; fall back to in-app banners. |
| Scope creep | Phases 1–6 are the MVP. Nothing from Phase 7 until the demo script runs end to end. |
