# Unhooked: Submission Guide for Judges

**Pause. Understand. Decide.** Unhooked is an Android app for Filipinos who are juggling online loans and pay-later installments, and losing nights to doomscrolling. When one of those hooks pulls (borrowing, checking out, opening Shopee at midnight), Unhooked steps in with a **real 10-second pause** and a **reflection written on the phone by an on-device language model from the user's own records**. The user always makes the final call.

This page maps the whole app to the five judging criteria, with the file that proves each claim. Full research, personas and phase plan: [`plan.md`](./plan.md). Setup and architecture: [`README.md`](./README.md).

---

## At a glance

| Criterion                                                | Weight | Strongest evidence                                                                                                                                           |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Problem & usefulness](#1-problem--usefulness-25)        | 25%    | 47,446 lending-app harassment complaints; BNPL ≈ 42% of monthly income; one clear user (Ana, 24, BPO agent); free, offline, no sign-up                       |
| [Local AI implementation](#2-local-ai-implementation-25) | 25%    | Four on-device LLMs via LiteRT-LM (NPU → GPU → CPU), on-device Whisper speech, on-device OCR; the core pause is phrased on the phone; works in airplane mode |
| [Technical execution](#3-technical-execution-20)         | 20%    | 119 Jest tests in 23 suites; two native Kotlin modules; guarded generation that rejects invented numbers; instant fallbacks so the demo never blocks         |
| [Innovation](#4-innovation-15)                           | 15%    | The 10-second pause doubles as the model's thinking time; Payday Shield; Utang Scanner with SEC-number check and complaint draft                             |
| [Product & demo quality](#5-product--demo-quality-15)    | 15%    | Ginto the goldfish mascot, plain language, no shame; a 3-minute demo script that runs offline                                                                |

---

## Highlight features

These five are the ones to show first.

| #   | Feature                            | What the user sees                                                                                                                                                                                                                | Local AI                                                                                                                | Code                                                                                                                                                                               |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The AI Pause**                   | A 10-second countdown before borrowing, buying or opening a guarded app, then a reflection that uses their own numbers ("₱3,000 is due before payday") and options: wait 24 h, look for cheaper, or continue                      | On-device LLM phrases the reflection during the countdown; a guard rejects any number the app did not compute           | [`src/app/pause.tsx`](./src/app/pause.tsx), [`src/ai/pausePhrasing.ts`](./src/ai/pausePhrasing.ts), [`src/ai/guard.ts`](./src/ai/guard.ts)                                         |
| 2   | **Payday Shield**                  | Opening Shopee, Lazada, TikTok Shop, Temu or SHEIN shows safe-to-spend per day until payday, the next debt due, and what is cooling off; one tap saves the item to a 24-hour wishlist                                             | Android usage-events service detects the app on the device; all math on the phone                                       | [`src/app/shield.tsx`](./src/app/shield.tsx), [`src/domain/paydayShield.ts`](./src/domain/paydayShield.ts), [`modules/unhooked-guard`](./modules/unhooked-guard)                   |
| 3   | **Utang Scanner**                  | Add a loan-app screenshot: it fills in lender, amount and due date, says whether SEC registration and Certificate of Authority numbers are shown, flags collector threats, saves them as evidence and drafts an SEC complaint PDF | On-device OCR (ML Kit on Android, Tesseract.js in the browser); rules engine for threats                                | [`src/app/scan.tsx`](./src/app/scan.tsx), [`src/domain/utangScan.ts`](./src/domain/utangScan.ts), [`src/domain/secComplaint.ts`](./src/domain/secComplaint.ts)                     |
| 4   | **Ask Ginto**                      | A chat about their own budget, debts and scrolling, in English or Taglish, by text, voice or photo                                                                                                                                | On-device LLM; on-device Whisper speech-to-text; Gemma 4 reads photos on the phone; crisis wording bypasses every model | [`src/app/chat.tsx`](./src/app/chat.tsx), [`src/ai/androidLocalAi.ts`](./src/ai/androidLocalAi.ts), [`src/ai/speechModel.ts`](./src/ai/speechModel.ts)                             |
| 5   | **Scan a message + Evidence Pack** | Paste a collector's text: threats, shaming and exposure are highlighted and explained; save it with screenshots; export a dated PDF for SEC, PNP-ACG or NPC                                                                       | Rules engine (English + Taglish) plus on-device LLM explanation                                                         | [`src/app/message-check.tsx`](./src/app/message-check.tsx), [`src/domain/messageRisk.ts`](./src/domain/messageRisk.ts), [`src/app/evidence-pack.tsx`](./src/app/evidence-pack.tsx) |

---

## The whole app

### Screens

| Area       | Screen                | Purpose                                                                            | Route file                                                                                                   |
| ---------- | --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Today**  | Home                  | Hooks dodged this week, what is coming up, one insight worth a look, quick actions | [`src/app/(tabs)/index.tsx`](<./src/app/(tabs)/index.tsx>)                                                   |
|            | Daily check-in        | Mood, stress and tiredness in three taps; softens Ginto's tone                     | [`src/app/check-in.tsx`](./src/app/check-in.tsx)                                                             |
|            | Check-in history      | 7-day mood line and one row per day                                                | [`src/app/check-in-history.tsx`](./src/app/check-in-history.tsx)                                             |
|            | Your week (Insights)  | Patterns from the user's own activity, each labeled fact / estimate / suggestion   | [`src/app/(tabs)/insights.tsx`](<./src/app/(tabs)/insights.tsx>)                                             |
|            | Unhooked Wrapped      | Shareable 7-day summary: money kept by waiting, repaid, hooks dodged, scrolling    | [`src/app/wrapped.tsx`](./src/app/wrapped.tsx)                                                               |
| **Debt**   | Debt list             | What you owe and what you are owed, next due date                                  | [`src/app/(tabs)/debt.tsx`](<./src/app/(tabs)/debt.tsx>)                                                     |
|            | Add a debt            | Lender, amount, due date, interest                                                 | [`src/app/debt-new.tsx`](./src/app/debt-new.tsx)                                                             |
|            | Repayment plan        | Due-date, highest-cost or smallest-first ordering                                  | [`src/app/repayment-plan.tsx`](./src/app/repayment-plan.tsx)                                                 |
|            | Before you borrow     | Borrowing pause with upcoming obligations                                          | [`src/app/borrow.tsx`](./src/app/borrow.tsx)                                                                 |
|            | Utang Scanner         | Screenshot to debt, SEC-number check, complaint draft                              | [`src/app/scan.tsx`](./src/app/scan.tsx)                                                                     |
|            | Scan a message        | Collector message risk analysis                                                    | [`src/app/message-check.tsx`](./src/app/message-check.tsx)                                                   |
|            | Evidence Pack         | Saved screenshots and messages, PDF export                                         | [`src/app/evidence-pack.tsx`](./src/app/evidence-pack.tsx)                                                   |
|            | Reported numbers      | Local log of collector numbers, portable between phones                            | [`src/app/number-log.tsx`](./src/app/number-log.tsx)                                                         |
| **Spend**  | Spend                 | Safe to spend per day until payday, cooling-off list, history                      | [`src/app/(tabs)/spend.tsx`](<./src/app/(tabs)/spend.tsx>)                                                   |
|            | Check a purchase      | Affordability and BNPL true cost before checkout                                   | [`src/app/spend-check.tsx`](./src/app/spend-check.tsx)                                                       |
|            | Payday Shield         | Shown when a guarded shopping app opens                                            | [`src/app/shield.tsx`](./src/app/shield.tsx)                                                                 |
| **Scroll** | Scroll                | Unhook timer, guarded apps and websites, doomscroll fade                           | [`src/app/(tabs)/scroll.tsx`](<./src/app/(tabs)/scroll.tsx>)                                                 |
|            | Guard apps / websites | Pick installed apps or add websites to pause                                       | [`src/app/block/apps.tsx`](./src/app/block/apps.tsx), [`src/app/block/sites.tsx`](./src/app/block/sites.tsx) |
|            | Break                 | A 2-minute offline break idea                                                      | [`src/app/break.tsx`](./src/app/break.tsx)                                                                   |
| **Pause**  | AI Pause              | The core loop (see highlight 1)                                                    | [`src/app/pause.tsx`](./src/app/pause.tsx)                                                                   |
| **Ginto**  | Ask Ginto             | On-device chat, voice and photo                                                    | [`src/app/chat.tsx`](./src/app/chat.tsx)                                                                     |
| **Safety** | Help and safety       | NCMH 1553, 911, SEC, PNP-ACG, NPC, one tap from Today, Debt and Settings           | [`src/app/help.tsx`](./src/app/help.tsx)                                                                     |
|            | Settings              | Name, budget and payday, pause length, guards, delete all data                     | [`src/app/settings.tsx`](./src/app/settings.tsx)                                                             |

### Code layout

```
src/
  app/          Expo Router screens (thin)
  domain/       Pure TypeScript rules and math, every file unit-tested (money, affordability, bnpl,
                repayment, allowance, paydayShield, utangScan, messageRisk, blocking, wellness, ...)
  ai/           On-device model bridge, model picker, speech model, prompt phrasing, output guard, chat
  db/           SQLite migrations, repositories, append-only event log
  lib/          OCR, notifications, PDF export, guard sync
  components/   UI kit, Ginto mascot, countdown ring
modules/
  ginto-local-ai/   Kotlin: LiteRT-LM engine (NPU → GPU → CPU), Whisper speech, device inspection
  unhooked-guard/   Kotlin: usage-events foreground service, shield deep link, local DNS VpnService
```

---

## 1. Problem & usefulness (25%)

**The problem.** Debt, impulse pay-later spending and doomscrolling feed each other and hurt mental health, and the people affected rarely seek help.

- **Debt and harassment:** PAOCC logged **47,446** online-lending-app complaints (Aug 2024 – Jan 2026), mostly harassment and contact-shaming. Debt is linked to depression (OR **2.77**).
- **Pay-later spending:** the average BNPL purchase is ≈ **42% of monthly income**; BNPL use comes with **1.91×** odds of depressive symptoms.
- **Scrolling:** Filipinos spend ≈ **4.8 h/day** on social media.
- **Help-seeking:** only **2.2–17.5%** of Filipinos with mental-health problems seek help, mainly because of cost and stigma.

Sources and how each one maps to a feature: [`plan.md` §4](./plan.md#4-research--feature-traceability-for-judges).

**The target user.** Filipino adults 18–35 on a salary or allowance, on an Android phone, with online loans or BNPL plans and heavy scrolling, who are unlikely to seek professional help. Primary persona: **Ana, 24, BPO agent in Pasig**, ₱22,000/month paid on the 15th and 30th, three online loans and two SPayLater plans, getting threatening texts from a collector. Full personas: [`plan.md` → Target users](./plan.md#target-users).

**A realistic use case.** At 11:48 pm Ana opens Shopee. The Payday Shield shows **₱420/day safe to spend until payday on Oct 15**, **₱3,000 due to Pera Agad on Saturday**, and that her earbuds are still cooling off. She saves the new item to her 24-hour wishlist instead. The next morning a collector texts her; she screenshots it into the Utang Scanner, which flags the threat, shows the lender has no SEC numbers on screen, saves it as evidence and drafts an SEC complaint.

**Public benefit.** Free, no account, no sign-up, works offline on a budget Android phone, stores everything on the device, and points to real help (NCMH 1553, SEC, PNP-ACG, NPC) one tap away.

## 2. Local AI implementation (25%)

**Local inference is the product.** The core loop is _Trigger → AI Pause → Reflection → Decision_, and the reflection is written on the phone. The app computes the facts in `src/domain`; the on-device model turns them into a warm, personal line during the countdown; [`src/ai/guard.ts`](./src/ai/guard.ts) rejects any model output with a number the app did not compute or a shaming word.

**What runs on the device**

| Component      | Model / engine                                                                                    | Used for                                                | Code                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language model | Gemma 4 E2B (default, ≈ 2.6 GB) and Gemma 4 E4B (≈ 3.7 GB) through **LiteRT-LM** | Pause reflections, Ask Ginto, message-risk explanations | [`GintoLocalAiModule.kt`](./modules/ginto-local-ai/android/src/main/java/expo/modules/gintolocalai/GintoLocalAiModule.kt), [`src/ai/localModels.ts`](./src/ai/localModels.ts) |
| Vision         | Gemma 4 E2B / E4B (text + vision)                                                                 | Reading a photo the user sends Ginto                    | [`src/ai/androidLocalAi.ts`](./src/ai/androidLocalAi.ts)                                                                                                                      |
| Speech         | Whisper small (int8, ONNX) via sherpa-onnx                                                        | Voice input in Tagalog, Taglish or English              | [`WhisperSpeech.kt`](./modules/ginto-local-ai/android/src/main/java/expo/modules/gintolocalai/WhisperSpeech.kt), [`src/ai/speechModel.ts`](./src/ai/speechModel.ts)           |
| OCR            | Google ML Kit (Android), Tesseract.js (web)                                                       | Utang Scanner, Evidence Pack screenshots                | [`src/lib/ocr.ts`](./src/lib/ocr.ts), [`src/lib/ocr.web.ts`](./src/lib/ocr.web.ts)                                                                                            |
| Rules engine   | Explainable patterns in English and Taglish                                                       | Collector threat detection, SEC-number detection        | [`src/domain/messageRisk.ts`](./src/domain/messageRisk.ts), [`src/domain/utangScan.ts`](./src/domain/utangScan.ts)                                                            |
| App detection  | Android usage events in a foreground service                                                      | Payday Shield, app guards                               | [`AppGuardService.kt`](./modules/unhooked-guard/android/src/main/java/expo/modules/unhookedguard/AppGuardService.kt)                                                          |

**Hardware use.** Each model tries the **NPU**, then the **GPU**, then the **CPU**, and the app shows which one it is running on. The user can choose Auto, NPU, GPU or CPU and a Balanced or Max performance mode in Ask Ginto → model settings. The model picker reads total and free RAM, low-memory state, battery and free storage, and recommends a model that fits the phone ([`src/ai/localModels.ts`](./src/ai/localModels.ts) → `recommendLocalModel`). The model is warmed at launch so it answers inside the 10-second pause ([`src/hooks/useWarmLocalModel.ts`](./src/hooks/useWarmLocalModel.ts)).

**Why local matters here**

- **Privacy:** debts, collector messages and screenshots are exactly what this user would never upload. Everything stays in SQLite on the phone.
- **Latency:** the reflection has to be ready inside a 10-second countdown; there is no round trip.
- **Offline:** the full demo runs in airplane mode.
- **Cost:** zero per-user inference cost, so it can stay free for people already in debt.
- **Stigma:** nothing leaves the phone, so there is no record anywhere that the user has debt.

**What breaks without local AI**

| Feature                       | With local AI                                               | Without it                               |
| ----------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| AI Pause                      | A personal reflection using the user's own numbers and name | A fixed template                         |
| Ask Ginto                     | Open conversation by text, voice or photo                   | Keyword answers only; no voice, no photo |
| Scan a message                | Rule flags plus a model explanation in plain words          | Rule flags only                          |
| Utang Scanner / Evidence Pack | Screenshots read into text automatically                    | The user types everything by hand        |
| Payday Shield                 | Detects the shopping app on the device                      | Cannot trigger                           |

## 3. Technical execution (20%)

- **It works and is tested.** `npm run check` runs TypeScript strict mode, ESLint and **119 Jest tests in 23 suites** covering money, affordability, BNPL, repayment, allowance, Payday Shield, Utang Scanner, message risk, blocking, wellness, insights and the AI output guard.
- **Model integration.** A typed Expo native module (`requireOptionalNativeModule('GintoLocalAi')`) with safe fallbacks on web and Expo Go. Inference has a timeout; the pause uses a fresh conversation every time so chat history never leaks into it; the model picker falls back to any installed model instead of failing.
- **Guarded generation.** Rules compute, the model only phrases. Every number in model output must match a number the app computed, or the template is kept ([`src/ai/guard.ts`](./src/ai/guard.ts), tested in [`src/ai/__tests__/guard.test.ts`](./src/ai/__tests__/guard.test.ts)). Crisis wording skips every model and returns the hotline.
- **Native work.** Two Kotlin modules: LiteRT-LM with NPU detection and Whisper speech ([`modules/ginto-local-ai`](./modules/ginto-local-ai)); a usage-events foreground service, shield deep link and a DNS-only `VpnService` for website guards ([`modules/unhooked-guard`](./modules/unhooked-guard)). No Accessibility service, no `QUERY_ALL_PACKAGES`.
- **Data.** SQLite with versioned migrations and an append-only event log that powers Insights. Money is stored as integer centavos end to end.
- **Demo reliability.** Every AI path has an instant fallback: the template shows immediately and the model's wording swaps in when it is ready, so the demo never waits on inference.

## 4. Innovation (15%)

- **The pause is the prompt window.** The PNAS _one sec_ study found the delay itself cut app opens by 57%. Unhooked keeps that delay real and uses those same 10 seconds as the model's thinking time.
- **A money app the model cannot lie in.** The model is allowed to be warm and personal, but structurally cannot invent an amount.
- **Every line is labeled** _From your records_, _Estimate_ or _Suggestion_, so the user always knows what is fact and what is the AI talking.
- **Payday Shield** turns "don't shop" into "here is what you can safely spend per day until payday", computed from the user's own budget and debts, at the exact moment they open the shopping app.
- **Utang Scanner** turns a frightening screenshot into action: the debt gets tracked, the lender's SEC numbers get checked, threats become evidence, and a complaint is drafted, all without the screenshot leaving the phone.
- **Local AI enables something new:** an assistant that reads a person's debt ledger, collector messages and shopping habits and talks to them in Taglish, offline, on a budget phone, with no stigma risk because nothing is uploaded.

## 5. Product & demo quality (15%)

- **Understandable.** Four tabs (Today, Debt, Spend, Scroll), plain language, one primary action per screen.
- **Usable and kind.** No shame language, no guarantees, and _Continue_ is always available after the pause. Red is used only for high-risk collector messages, never for the user's setbacks.
- **Memorable.** Ginto the goldfish swims past the hook; the hook is the trigger and gets pulled away when the user waits.
- **Shareable.** Unhooked Wrapped turns a week of small wins into a card the user can share.

**3-minute demo (airplane mode on)**

1. **Today:** hooks dodged this week, what is due, one insight.
2. **Payday Shield:** open the Shopee preview → safe-to-spend per day, next debt, cooling item → _Save to wishlist for 24h_.
3. **Spend:** check a ₱4,500 item → affordability conflict → checkout pause with a 10-second countdown and an on-device reflection.
4. **Utang Scanner:** add a loan-app screenshot → lender, amount and due date filled in → "No SEC numbers shown" → threat flagged → save to Evidence Pack → draft SEC complaint.
5. **Ask Ginto:** ask by voice in Taglish "Kaya ko ba bumili ng ₱1,500?" → on-device answer from the user's records.
6. **Scroll:** start the Unhook timer → open a guarded app → shield.
7. **Wrapped:** the week on one card.

---

## Privacy and network

Records stay on the device. The app only reaches the network in these cases, and only when the user starts them:

| When                                              | What                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Downloading a model in Ask Ginto → model settings | Model file from Hugging Face                                                           |
| First screenshot scan on web                      | Tesseract.js reader files from jsDelivr (the screenshot itself is read in the browser) |
| A website guard is on (Android)                   | DNS lookups only, through a local VPN                                                  |
| Tapping a help or SEC link                        | Opens the browser                                                                      |

There is no cloud AI. Chats, voice, photos and records are never sent to an AI service.

## Verify it yourself

```bash
npm install
npm run check           # typecheck + lint + 119 tests
npx expo run:android    # full app with on-device AI and guards
npx expo start --web    # web preview (no native AI or guards)
```
