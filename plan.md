# Unhooked — Build Plan

> **Pause. Understand. Decide.** An AI-in-Health wellness assistant for debt, spending, and doomscrolling.
> Source spec: [`initalplan.md`](./initalplan.md) · Agent rules: [`CLAUDE.md`](./CLAUDE.md)

**Status (Oct 9):** Phases 0–4 built on real user data · Phase 4B built, **not yet run on a device** · Ask Ginto chat added.

| Area | State |
|---|---|
| Today, Debt, Spend, Scroll, Insights | Real data from SQLite; empty states; real-app hierarchy (large titles, dark hero, grouped lists, icon grid); floating tab bar with a center pause button |
| AI Pause, Unhooked | Facts from the user's records → `localProvider` templates, labeled lines, real countdown, haptic |
| Debt | Add owed/lent, payments, settle, delete, borrowing pause, Evidence Pack (screenshots + saved messages) |
| Spend | Budget, purchase check (affordability, cheaper option, BNPL true cost), 24h cooling with reminder, recent |
| Scroll | Guards (apps + sites, schedules, Pause/Strict), Unhook timer, scroll timer with check-in, stats |
| Safety | On-device message detector (English + Taglish) with highlights; Help |
| Ask Ginto | On-device answers from the user's numbers; opt-in Claude via `server/ginto-proxy.mjs` (numbers only) |
| Phase 4B native | `AppGuardService` (usage events → shield deep link), `WebGuardVpnService` (local DNS-only), allowances, VPN consent. Needs `npx expo run:android`; untested |
| Still open | Phase 2–3 phone tap-through (PDF sharing and cooling reminder), seed demo data, Taglish copy, device test of 4B, Play declarations |
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

## Brand & mascot

**Prototype canvas (tap-through app, mascot sheet, brand board):** https://claude.ai/artifact/VMcLVnPGSGS9xtLLjfquDw. Source files are in [`prototype/project/`](./prototype/project/).

- **Ginto the goldfish** (Filipino for gold): the mascot from `assets/logo initial.png`, a goldfish that keeps swimming past the hook. Ginto has 9 moods, each tied to a moment: Hello, Happy, Curious (a hook appears), Calm (the pause countdown), Worried (overlapping repayments), Proud (Unhooked!), Sleepy (late-night scrolling), Thinking, and Brave (safety). Mood comes from the eyes, brows and mouth; the body stays the same. Ginto never scolds and never points at money.
- **The hook is the trigger.** It drops in when a risky decision starts and gets yanked away when the user waits, saves or asks for help.
- **Type:** Poppins (400–800). **Color:** Goldfish `#FF6B1A` (always with Ink text), Ember `#C4450B`, Ink `#2A1608`, Cream `#FFF6EC`, Peach `#FFE3CC`, Deep water `#0B3440` (pause), Lagoon `#0F5F6E` (scroll), Amber `#FFB061`, Alert `#B3261E` (high-risk messages only). Tokens are in `src/constants/theme.ts`.
- **Motion:** Ginto swims between screens (800 ms) instead of popping in; the hook drops and yanks with overshoot (900 ms); the pause breathes 4 s in and 4 s out; screens rise 14 px over 450 ms. Reduced motion turns all of it off.
- **No emoji, no sparkle-style "AI" icons.** Use plain stroke icons only.

---

## 0. North star & non-negotiables

These come straight from the research brief. Every phase must respect them. A feature that breaks one is not done.

| # | Rule | Why (evidence) | How it shows up in code |
|---|------|----------------|-------------------------|
| R1 | **The pause is a real delay**, not just a message. | PNAS *one sec* study: the delay drove the 57% reduction; a message alone did not. | `src/app/pause.tsx` blocks the decision buttons for `settings.pauseSeconds` (default 10s). |
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
modules/
  unhooked-guard/         ← Phase 4B local Expo module (Kotlin): installed apps, usage access, shield, local DNS VPN. Android only.
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

### Phase 0.5 — UI pass ✅
Every screen matches the prototype, on demo data for persona Ana (`src/demo/ana.ts`). Later phases swap the demo data for real repositories without redesigning the screens.
- [x] Poppins via `@expo-google-fonts/poppins`; type scale, buttons, cards, tags, list rows and headers in `src/components/ui.tsx`
- [x] Ginto in `react-native-svg` (`src/components/mascot/Ginto.tsx`), with 9 moods animated on the native driver through layered SVGs and `transformOrigin`, plus reduced-motion support. The plan had called for Reanimated; the built-in Animated API was enough.
- [x] Hook (`Hook.tsx`), countdown ring (`pause/CountdownRing.tsx`), dot pattern, global toast
- [x] Screens: Welcome (first launch), Today, Spend, Debt, Scroll + check-in sheet, Insights, Pause (checkout/borrow), Unhooked, Break, Check-in (saved to SQLite), Message check (sample), Help, Settings (pause length, delete data)
- [x] Web works: Metro `.wasm` support, `localStorage` for settings on web (`store/storage.web.ts`), and a retry for the OPFS lock on reload (`db/DatabaseGate.tsx`)

### Phase 1 — The AI Pause (core loop) ✅
The pause uses real on-device records and deterministic local templates. Gemma and OCR are not needed for this phase.
- [x] Pause screen with a real countdown: decision buttons are disabled until it ends (R1); Ginto breathes, then swims up and reacts; the hook drops in
- [x] Reflection card with labeled lines (`Tag` from your records / estimate) (R3)
- [x] Always-visible "Need to talk to someone?" link → `/help` (R5)
- [x] Log `pause_shown` and `pause_decision { kind, decision, secondsViewed }`
- [x] Load real Debt/Spend facts from the repositories, compute affordability in `src/domain/pauseFacts.ts`, and call `getReflectionProvider().reflect()`; no `pauseCopy` demo text.
- [x] Scroll pause kind (*I'm using this intentionally* · *Take a break* · *Remind me later*): the Scroll timer opens the pause and records the chosen session outcome.
- [x] Haptic tick when the countdown completes
- [x] `src/ai/templates.ts` — template tables per `PauseKind × Tone`; `localProvider` fills them from `facts`. Tests cover shame words, number provenance, and gentle tone when stress/fatigue ≥ 4.

**Done when:** each tab's trigger button opens a pause, countdown blocks decisions, decision is in the `events` table.

### Phase 2 — Debt
- [x] `src/db/debts.ts` repository: create/list/close debts, add payments, list with balances.
- [x] Implement `domain/repayment.ts` (`balances`, `planRepayment`: due-date / avalanche / snowball, unrealistic-plan warning) + tests.
- [x] Debt tab: segmented **I owe / Owed to me** list, outstanding total, next due date; add-debt form; record partial payment.
- [x] Repayment planner screen: budget input → ordered plan, months-to-clear, warning (labeled *estimate*).
- [x] Money owed to you: "Draft a polite reminder" (template, shareable text).
- [x] Repayment reminders: local notification the day before `dueDate`.
- [x] **Debt Evidence Pack** (phone app): pick screenshots (`expo-image-picker`) → copy into app document dir → tag lender + incident date + note → list grouped by lender/date → **Export PDF** (`expo-print` → `expo-sharing`). Include a cover page with dates and a disclaimer. Web can list saved messages but cannot export the pack.
- [x] **Borrowing pause**: "I'm thinking of borrowing" → amount input → facts = upcoming repayments this month, remaining budget → `/pause?kind=borrow`.
- [x] `deleteAllData` also deletes evidence image files.

**Done when:** demo script steps D1–D3 (§5) work end to end.
**Verification remaining:** tap through D1–D3 and PDF sharing in Expo Go on a phone; automated checks, Expo Doctor and Android bundling pass.

### Phase 3 — Spend
- [x] Budget onboarding (monthly income, fixed bills, savings goal, pay schedule: monthly **or 15th/30th**) → `settings.budget`. `BudgetProfile.payday` supports twice-monthly pay (persona Ana); affordability remains explicitly a monthly estimate.
- [x] `domain/affordability.ts` + `domain/bnpl.ts` + tests (including the ₱4,500 demo case).
- [x] `src/db/purchases.ts` repository, with actual bought date for monthly spend totals.
- [x] Purchase planner form: item, price, need/want, planned date, optional cheaper alternative.
- [x] Affordability result card: verdict, remaining after purchase, conflicts with upcoming repayments (pull from Debt), all labeled *estimate*.
- [x] Inline BNPL calculator in Spend Check: total repayment vs. upfront, extra cost ₱ and %.
- [x] Checkout pause → options; **Save for 24h** sets `cooling_until`, schedules a local notification, logs `purchase_saved_for_later`.
- [x] Cooling list: live countdown per item; when due, re-run affordability and ask "Still want it?" (bought / skipped).

**Done when:** the full §5 user journey (S1–S5) runs without touching code.
**Verification remaining:** tap through S1–S5 and the 24-hour notification on a phone; typecheck, lint, tests, Android/web bundles pass.

### Phase 4 — Scroll
- [ ] Implement `domain/scroll.ts` + tests.
- [ ] App picker (Facebook, TikTok, Instagram, YouTube, X, custom) + per-session limit (default `settings.scrollLimitMinutes`).
- [ ] Session runner: start → timer → local notification at the limit (works when the app is backgrounded) → opens `/pause?kind=scroll`.
- [ ] Manual entry fallback ("I scrolled 45 min on TikTok last night").
- [ ] Break suggestions (walk, stretch, water, unfinished task, offline activity) — rotate, never repeat twice in a row; log `break_taken`.
- [ ] Habit insights: longest sessions, time-of-day histogram, breaks taken this week.
- [ ] Honest copy: "Unhooked can't see other apps automatically yet — start a session when you open one."

### Phase 4B — App & website blocking (Android only, dev build)
The user picks which apps and websites get a "hook guard". Opening one shows Ginto's pause (R1) instead of the app or site. This is a speed bump the user sets up for themselves, not parental control. **It needs native code, so it does not run in Expo Go.** It ships in a development build (`npx expo run:android` or `eas build --profile development`) and the Expo Go demo must still work without it.

**Policy-safe approach.** Choose the least intrusive Android API for each job and avoid the APIs Google Play restricts most:

| Job | Use | Do **not** use (why) |
|---|---|---|
| List installed apps | `<queries>` with an `android.intent.action.MAIN` + `android.intent.category.LAUNCHER` intent, then `PackageManager.queryIntentActivities`. This returns launchable apps only. | `QUERY_ALL_PACKAGES`: a high-risk permission that needs a Play declaration, and an app blocker doesn't qualify. |
| Know which app is open | `UsageStatsManager.queryEvents` (activity-resumed events). The user grants **Usage access** in system Settings. | `AccessibilityService`: Play allows it only for real accessibility tools, so it needs a declaration and is often rejected. Android 17 also lets users block non-accessibility tools from using it. |
| Show the pause over the blocked app | Launch Unhooked's own full-screen shield activity. The user grants **Display over other apps** (`SYSTEM_ALERT_WINDOW`), which also exempts us from background-activity-start limits. | Drawing fake system UI, or covering the screen with no way out. |
| Keep watching in the background | A foreground service with a discreet, permanent notification ("Unhooked is on", never anything about debt or blocking). Android 14+ requires a `foregroundServiceType` (`specialUse` with a subtype property), and it must be declared in Play Console. | Hidden background polling, wake locks, or `RECEIVE_BOOT_COMPLETED` tricks the user wasn't told about. |
| Block websites | A **local-only** `VpnService` that answers DNS only for the user's listed domains and passes everything else through untouched. No traffic leaves the device through us, nothing is logged, and no remote server is used. Requires the Play Console VpnService declaration (VPN isn't core functionality; declare it under app usage tracking) and an in-app disclosure. | Reading browser URLs through Accessibility, routing traffic to a server, or ad or content filtering beyond the user's list. |

**If Play rejects the VpnService declaration**, drop website blocking from the Play build and keep app blocking. The fallback is to let the user add browsers to the app block list and say so honestly.

**Native code lives in a local Expo module** at `modules/unhooked-guard` (Kotlin, Expo Modules API). Its own `AndroidManifest.xml` is merged into the app by Gradle, so **never hand-edit `android/`** and **never** add `QUERY_ALL_PACKAGES` or an accessibility service. Add each permission in the step that needs it.

**Tasks**
- [x] **Step 1: module + installed apps + permission checks.** `modules/unhooked-guard` exposes `getLaunchableApps(includeIcons)`, which returns `{ packageName, label, iconBase64, category, isEssential }`. `isEssential` marks the default dialer, default SMS app and Settings. It also exposes `hasUsageAccess()` / `openUsageAccessSettings()` and `canDrawOverlays()` / `openOverlaySettings()`. The module manifest adds only the `<queries>` launcher intent, `PACKAGE_USAGE_STATS` and `SYSTEM_ALERT_WINDOW`. The JS wrapper returns safe fallbacks when the module is missing (Expo Go, iOS, web).
- [ ] `src/domain/blocking.ts` (pure, tested):
  - `normalizeDomain(input)`: accepts anything the user types or pastes (`https://www.TikTok.com/@x?y`, `m.facebook.com`, `shopee.ph/`) and returns a bare lowercase host (`tiktok.com`). Strip the scheme, `www.`/`m.`, path, query and port. Reject IPs, empty input, `localhost` and invalid hosts with a gentle error.
  - `matchesDomain(host, rules)`: a rule covers its subdomains (`tiktok.com` blocks `vt.tiktok.com`), but not look-alikes (`nottiktok.com`).
  - `isGuardActive(rule, now)`: always on, or a user schedule such as "10 PM–6 AM", including windows that cross midnight. Use local time.
  - `NEVER_BLOCK`: Unhooked itself, any app the native side marks `isEssential` (phone, SMS, Settings), and the domains in `src/constants/resources.ts` (help must stay reachable, R5). Pickers hide these, and rules skip them.
- [ ] Migration v2 (append a step and bump `DATABASE_VERSION`): `block_rules (id, kind 'app'|'site', target, label, mode 'pause'|'strict', schedule_json, enabled, created_at)`. Store **only the apps the user selected**, never the full installed-app list. Add the `src/db/blockRules.ts` repository and these `AppEventType` values: `block_rule_added`, `block_rule_removed`, `block_shield_shown`, `block_decision { kind, decision, secondsViewed }`.
- [ ] **App picker screen** (`src/app/block/apps.tsx`): shows **all launchable apps** with icon and name, sorted A–Z, with a search box and optional filter chips (Social · Video · Games · Other) from `ApplicationInfo.category`. Android has no "shopping" category, so shopping apps are found by search. **Nothing is preselected.** The user ticks the apps to guard, then picks a mode and schedule for each. Rows are at least 48dp.
- [ ] **Website screen** (`src/app/block/sites.tsx`): a text field where the user types or pastes a link, then "Add". Show the normalized domain back ("Will guard **shopee.ph** and its subpages") before saving. The list supports remove and an enable toggle. Validation errors use plain language.
- [ ] **Permission onboarding** (one screen per permission, shown just before it's needed). Each screen says what the permission is, why Unhooked needs it, and that the data stays on the phone. It has an explicit **Allow** button (affirmative consent, per Play's prominent-disclosure rule) and a **Not now** option that still leaves the app usable. Then deep-link to the matching system setting and re-check when the user returns.
- [ ] **Guard service**: a foreground service (`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` with a subtype property, `POST_NOTIFICATIONS`) that reads usage events every ~1 s **only while the screen is on**. When an enabled, in-schedule app comes to the front, it launches the shield. Expose `startGuard(rules)` / `stopGuard()` and a shield-result event.
- [ ] **Shield screen**: Ginto + hook + countdown with a scroll-style reflection (labeled, R3), using these options:
  - **Pause mode (default):** *Close it* · *Take a break* · *Open anyway* (enabled after the countdown; R4, the user decides). *Open anyway* lets the app through for the session length the user picked (default 10 min).
  - **Strict mode (opt-in, user-chosen):** *Open anyway* appears only after a longer pause (default 60 s) and asks "Still want to open it?" once more. It is never a hard lock, so the user can always turn a rule off in Unhooked.
  - Always show "Need to talk to someone?" → `/help` (R5).
- [ ] **Web guard**: a local DNS-only `VpnService` (`BIND_VPN_SERVICE`) with `startWebGuard(domains)` / `stopWebGuard()`. A blocked lookup gets "no such host" and a notification offers the shield.
- [ ] Guard on/off master switch in Settings, plus "Delete all data" stops both services and clears `block_rules`.
- [ ] iOS: hide the feature completely. Screen Time APIs need the Family Controls entitlement, which is out of scope. In Expo Go, show "Available in the full Android app", not a crash.
- [ ] Honest copy: "This is a speed bump, not a lock. Some browsers' Secure DNS or another VPN can get around website guards, and you can always turn a guard off."
- [ ] Play Console checklist before release: the foreground-service `specialUse` declaration, the VpnService declaration, a privacy policy and Data safety form saying installed-app and usage data are processed **on device only, not collected or shared**, and a store-listing line describing the guard.

**Done when:** on a real Android phone (dev build), the user picks TikTok from their installed apps and adds `shopee.ph`. Opening either shows the shield with a working countdown, each decision is in `events`, and turning the guard off restores normal behavior immediately.

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
- [ ] Automatic scroll detection: reuse the Phase 4B `unhooked-guard` usage-stats module to start Scroll sessions automatically (dev build only).
- [ ] Filipino / Taglish copy.
- [ ] Dark mode (tokens are ready; add a dark palette).

### Explicitly deferred (from spec §18)
Automatic detection across every app · background monitoring through Accessibility or `QUERY_ALL_PACKAGES` (Phase 4B uses only user-granted Usage access, overlay and a local VPN, with disclosure) · SMS/call interception · predictive behavioral models · bank integrations · automated repayment/collection · claims of definitive fraud detection.

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
| Play rejects the blocker (VpnService / foreground-service declarations) | Least-intrusive APIs only (no Accessibility, no `QUERY_ALL_PACKAGES`); prominent in-app disclosure; on-device only; drop website guard and keep app guard if needed. |
| Blocking feels punishing or traps the user | Pause mode by default, *Open anyway* after the countdown, strict mode opt-in, help and dialer never blocked, guard can always be turned off. |
| Scope creep | Phases 1–6 are the MVP. Nothing from Phase 7 until the demo script runs end to end. |
