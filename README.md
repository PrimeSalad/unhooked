# Unhooked

**Pause. Understand. Decide.** A local-AI wellness assistant for Filipinos juggling online loans, pay-later installments and late-night doomscrolling.

Unhooked steps in at the moment of a risky decision (borrowing, checking out, opening a shopping or social app) with a **real 10-second pause**, a reflection **written on the phone by an on-device language model from the user's own records**, and practical options. The user always makes the final call. Nothing leaves the phone unless the user explicitly opts in.

- **Local AI:** Gemma 3 1B / Qwen 2.5 1.5B / Gemma 4 E2B–E4B running through **LiteRT-LM** on the phone (NPU → GPU → CPU fallback), plus on-device ML Kit OCR and a transparent rules engine. See [Local AI implementation](#2-local-ai-implementation).
- **Verified by tests:** `npm run check` runs typecheck, lint and **83 Jest tests** across 18 suites (money, affordability, BNPL, repayment, message risk, blocking, and the AI output guard).
- **Target user:** Ana, 24, a BPO agent on a budget Android phone with 3 online loans and 2 SPayLater plans, paid on the 15th and 30th. See [plan.md → Target users](./plan.md#target-users).

---

## How it maps to the judging criteria

### 1. Problem & usefulness

| Question | Answer |
|---|---|
| Genuine problem? | **Debt, impulse pay-later spending and doomscrolling are linked mental-health risks in the Philippines.** PAOCC logged **47,446** online-lending-app complaints (Aug 2024–Jan 2026), mostly harassment and contact-shaming. The average BNPL purchase is ≈ **42 % of monthly income**. Filipinos spend ≈ **4.8 h/day** on social media. Debt is associated with depression (OR 2.77) and BNPL use with depressive symptoms (1.91× odds). Only **2.2–17.5 %** of Filipinos with mental-health problems seek help, mainly because of cost and stigma. Sources and traceability: [plan.md §4](./plan.md#4-research--feature-traceability-for-judges), [initalplan.md](./initalplan.md). |
| Clear target user? | Adults 18–35 on a salary or allowance, Android, with OLA/BNPL debt and heavy scrolling, unlikely to seek professional help. Four personas (Ana, Migs, Bea, Tita Lorna) drive every design decision ([plan.md → Target users](./plan.md#target-users)). |
| Realistic use case? | Ana is about to tap *Borrow* in a lending app at 11 pm. Unhooked shows her 10-second pause with **her** numbers: ₱7,500 still owed, ₱3,000 due before payday, and the collector message she saved as evidence. She chooses *Review what I owe* instead. The full 3-minute script is in [plan.md §5](./plan.md#5-demo-script-target-3-minutes). |
| Public benefit? | Free, no sign-up, no account, works offline on a ₱6,000 Android phone. Help & Safety (NCMH 1553, SEC, PNP-ACG) is one tap from every pause. |

### 2. Local AI implementation

| Question | Answer |
|---|---|
| Is local inference fundamental? | **Yes. The product's core loop is `Trigger → AI Pause → Reflection → Decision`, and the reflection is generated on the phone.** `src/domain/*` computes the numbers (tested, deterministic); the on-device LLM phrases them during the countdown; `src/ai/guard.ts` rejects any model output that contains a number the domain did not compute or a shame word. Ask Ginto (chat), the Scan-a-message risk analysis and the Utang Scanner (ML Kit OCR of loan-app screenshots) all run on-device too. |
| What runs where? | **LiteRT-LM** (`com.google.ai.edge.litertlm`) in a local Expo module, [`modules/ginto-local-ai`](./modules/ginto-local-ai/android/src/main/java/expo/modules/gintolocalai/GintoLocalAiModule.kt): tries **NPU**, then **GPU**, then **CPU** per model and reports which one it is using. Models: Gemma 3 1B int4 (~555 MB), Qwen 2.5 1.5B q8, Gemma 4 E2B/E4B (`src/ai/localModels.ts`). **ML Kit text recognition** for screenshot OCR (`src/lib/ocr.ts`). **Rules engine** for message risk in English + Taglish (`src/domain/messageRisk.ts`). **SQLite** for all records (`src/db`). |
| Device-aware? | `recommendLocalModel()` picks the model from total/available RAM, low-memory flag, battery level and free storage (`src/ai/localModels.ts`). The chat model sheet shows the device, RAM, recommended model and the active accelerator. The pause card shows **"Phrased on this phone · Gemma 3 1B on GPU · 1.8 s"**. |
| What breaks without local AI? | The pause falls back to fixed templates and loses personalised phrasing; Ask Ginto becomes a keyword bot; message analysis loses the model's explanation; OCR disappears. **There is no cloud AI**: every answer, phrasing and message check runs on the phone. |
| Privacy / latency / offline / cost | **Privacy:** debt, collector messages and screenshots are sensitive personal information under the Data Privacy Act 2012; they never leave the device. **Latency:** the reflection must be ready inside a 10-second pause; the model is warmed at launch (`src/hooks/useWarmLocalModel.ts`) so it answers within the countdown. **Offline:** the demo runs in airplane mode. **Cost:** zero per-user inference cost, which is what makes a free app for a prepaid-data audience viable. **Hardware:** NPU/GPU delegation when the chipset supports it. |

### 3. Technical execution

| Question | Answer |
|---|---|
| Does it work? | `npm run check` is green: TypeScript strict + `noUncheckedIndexedAccess`, ESLint, **83 tests / 18 suites**. Android bundle exports cleanly. |
| How are the models integrated? | Through a typed native module with graceful degradation: `requireOptionalNativeModule('GintoLocalAi')` returns safe fallbacks in Expo Go / iOS / web. Inference calls are wrapped in a **20 s timeout** (`withTimeout`), the pause uses a **fresh conversation per reflection** (`generateOnce`) so chat history never leaks into a pause, and the chat uses a persistent conversation grounded in a records summary. Model selection falls back to **any installed model** rather than failing silently. |
| Sophistication | **Rules compute, model phrases**: every number in model output is checked for provenance against the computed facts (`src/ai/guard.ts`, `src/ai/pausePhrasing.ts`, tested in `src/ai/__tests__/guard.test.ts`). Crisis wording (`isCrisis`) bypasses every model and returns the hotline. Money is integer centavos end-to-end. Payday Shield reads Android usage events in a foreground service and deep-links to the pause when a guarded app opens; a local DNS-only `VpnService` guards websites without routing traffic anywhere ([`modules/unhooked-guard`](./modules/unhooked-guard)). |
| Live-demo reliability | Every AI path has an instant deterministic fallback, so the demo never blocks on inference: the template renders immediately and the model's phrasing swaps in when it lands. Events (`pause_shown`, `pause_phrased`, `pause_decision`) are logged to SQLite for the Insights tab. |

### 4. Innovation

- **The pause is the prompt window.** The PNAS *one sec* study showed the delay itself, not the message, drove a 57 % drop in app opens. Unhooked keeps the delay real and uses those same 10 seconds as the model's thinking time.
- **Guarded generation for a money app.** The model is allowed to be warm and personal but structurally cannot invent an amount: `applyPausePhrasing` rejects unrecorded numbers and shame words and keeps the labeled template.
- **Every line is labeled** *From your records · Estimate · Suggestion* (`CertaintyTag`), so a user always knows what is fact and what is the model talking.
- **Local AI enables something new:** a pause that can read a user's debt ledger, collector messages and shopping habits and speak to them by name, in Taglish, offline, on a budget phone, with zero stigma risk because nothing is uploaded.
- **Payday Shield**: opening Shopee or Lazada at 11 pm shows *safe-to-spend per day until payday* computed from the user's budget and repayments, then offers *Save to wishlist for 24 h*.

### 5. Product & demo quality

- Mascot-led UX: **Ginto the goldfish** with 9 moods swims past the hook; the hook is the trigger and gets yanked away when the user waits.
- Plain language, no shame, no guarantees, the *Continue / Buy anyway / Open anyway* option is always there after the pause.
- 3-minute script in [plan.md §5](./plan.md#5-demo-script-target-3-minutes): Today → Spend ₱4,500 check → checkout pause → BNPL true cost → borrowing pause → message scan → scroll check-in → Insights, all in airplane mode.

---

## Non-negotiables (every feature is checked against these)

| # | Rule | In code |
|---|---|---|
| R1 | The pause is a real delay | `src/app/pause.tsx` disables decisions for `settings.pauseSeconds` |
| R2 | Local-first; no network without opt-in + disclosure | SQLite only; no cloud AI; the only downloads (model file, web text reader) happen when the user starts them |
| R3 | Every generated line is labeled fact / estimate / suggestion | `CertaintyTag`, `LabeledLine` |
| R4 | No shame, no guarantees, user decides | `guard.ts` shame/guarantee filters, template tests, *Continue* always present |
| R5 | Help one tap away | Help & Safety linked from pause, Today, chat crisis path |
| R6 | The AI never does math | `src/domain/*` (pure TS, Jest) computes; `src/ai/*` phrases |

---

## Getting started

Requires Node 20+.

```bash
npm install
npm start            # Expo Go: everything except native local AI and app guards
npx expo run:android # Development build: LiteRT-LM models, ML Kit OCR, Payday Shield
```

| Script | Purpose |
|---|---|
| `npm run check` | Typecheck + lint + tests (must be green) |
| `npm test` | Jest unit tests |
| `npm run doctor` | `expo-doctor` dependency checks |
| `npm run android` / `ios` / `web` | Start on a platform |

### Running a model on the phone

1. Install the development build (`npx expo run:android`).
2. Open **Ask Ginto → model settings**. The sheet shows your phone's RAM and the recommended model; tap **Download** (Gemma 3 1B is ~555 MB).
3. The model is warmed at the next launch. Open any pause: the card shows *Phrased on this phone · <model> on <NPU/GPU/CPU> · <seconds>*.
4. Turn on airplane mode and repeat. Nothing changes.

### App and website guards (Android)

Open **Scroll → Guards**, pick apps or add websites, and allow *Usage access* and *Display over other apps* when asked. These use only user-granted Usage access, an overlay, and a local DNS-only VPN; no Accessibility service, no `QUERY_ALL_PACKAGES`. Details in [plan.md → Phase 4B](./plan.md#phase-4b--app--website-blocking-android-only-dev-build).

---

## Architecture

```
src/
  app/        Expo Router screens (thin)  — pause, shield, chat, scan, message-check, tabs
  domain/     Pure TS + Jest: money, affordability, bnpl, repayment, messageRisk, utangScan, paydayShield, blocking
  ai/         localProvider (templates) · pausePhrasing + guard (LLM wording, provenance-checked)
              androidLocalAi (LiteRT-LM bridge, timeouts, model resolution) · localModels (device-aware picker) · chat
  db/         SQLite migrations, repositories, append-only event log
  lib/        OCR (ML Kit on Android, Tesseract.js on web), notifications, evidence PDF export, guard sync
modules/
  ginto-local-ai/   Kotlin: LiteRT-LM engine, NPU→GPU→CPU, generate / generateOnce / analyzeMessageRisk / inspectDevice
  unhooked-guard/   Kotlin: usage-events foreground service, shield deep link, local DNS VpnService
```

Data flow for every intervention:

```
Trigger → domain/* computes facts → localProvider template (instant)
        → on-device LLM rephrases headline + suggestion (during the countdown)
        → guard.ts verifies every number & tone → swap in, or keep template
        → user decides → events table → Insights
```

## APIs and outside services

Unhooked is local-first: debts, purchases, screenshots and check-ins never leave the phone. These are the only places the app talks to something outside the device, and when.

| Service | What it is used for | When it is contacted |
|---|---|---|
| [Hugging Face](https://huggingface.co/litert-community) (`litert-community` models) | Downloads the on-device chat model file | Only when you tap **Download** in Ask Ginto → model settings |
| [jsDelivr CDN](https://www.jsdelivr.com/package/npm/tesseract.js) (Tesseract.js reader files) | Text reader for the Utang scanner **on web** | Once, the first time you scan on web; the screenshot itself is read in the browser and never uploaded |
| [Google ML Kit Text Recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2) | Reads screenshots in the Utang scanner **on Android** | Runs fully on the device; no network |
| [Cloudflare DNS 1.1.1.1](https://one.one.one.one/) and [Google Public DNS 8.8.8.8](https://developers.google.com/speed/public-dns) | Upstream DNS for the website guard's local VPN (Android) | Only while a website guard is on; DNS lookups only, no traffic content |
| [SEC Philippines](https://www.sec.gov.ph) | "Check on the SEC website" link in the scanner and help resources | Only when you tap the link (opens your browser) |
| [PNP Anti-Cybercrime Group](https://acg.pnp.gov.ph) and [National Privacy Commission](https://privacy.gov.ph) | Where-to-report links | Only when you tap the link |

## Third-party libraries, models and assets

We did not build these. Each is used under its own license.

**App framework**

- [Expo SDK 57](https://docs.expo.dev/) and [Expo Router](https://docs.expo.dev/router/introduction/)
- [React](https://react.dev/) and [React Native](https://reactnative.dev/), [React Native Web](https://necolas.github.io/react-native-web/)
- [react-native-screens](https://github.com/software-mansion/react-native-screens), [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context), [react-native-svg](https://github.com/software-mansion/react-native-svg)
- [zustand](https://github.com/pmndrs/zustand) for saved settings

**Expo modules**

- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (local database), [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [expo-print](https://docs.expo.dev/versions/latest/sdk/print/) and [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) (Evidence Pack and SEC complaint PDFs)
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/), [expo-crypto](https://docs.expo.dev/versions/latest/sdk/crypto/), [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), [expo-clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/)
- [expo-device](https://docs.expo.dev/versions/latest/sdk/device/), [expo-constants](https://docs.expo.dev/versions/latest/sdk/constants/), [expo-linking](https://docs.expo.dev/versions/latest/sdk/linking/), [expo-font](https://docs.expo.dev/versions/latest/sdk/font/), [expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/), [expo-build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)
- [@react-native-community/datetimepicker](https://github.com/react-native-datetimepicker/datetimepicker)

**On-device AI and text reading**

- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (`com.google.ai.edge.litertlm:litertlm-android`), the Android runtime for the chat model
- Models from [litert-community on Hugging Face](https://huggingface.co/litert-community): [Gemma 3 1B IT](https://huggingface.co/litert-community/Gemma3-1B-IT), [Qwen 2.5 1.5B Instruct](https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct), [Gemma 4 E2B IT](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm), [Gemma 4 E4B IT](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm) (Gemma models under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms))
- [@react-native-ml-kit/text-recognition](https://github.com/a7med-mahmoud/react-native-ml-kit) wrapping [Google ML Kit Text Recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [Tesseract.js](https://github.com/naptha/tesseract.js) for screenshot reading on web

**Design**

- [Poppins](https://fonts.google.com/specimen/Poppins) via [@expo-google-fonts/poppins](https://github.com/expo/google-fonts) (SIL Open Font License)
- [Lucide](https://lucide.dev/) icons via [lucide-react-native](https://github.com/lucide-icons/lucide/tree/main/packages/lucide-react-native)
- [@expo/vector-icons](https://docs.expo.dev/guides/icons/)

**Developer tools**

- [TypeScript](https://www.typescriptlang.org/), [ESLint](https://eslint.org/) with [eslint-config-expo](https://github.com/expo/expo/tree/main/packages/eslint-config-expo), [Prettier](https://prettier.io/)
- [Jest](https://jestjs.io/) with [jest-expo](https://github.com/expo/expo/tree/main/packages/jest-expo) and [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)

## Project docs

- [`plan.md`](./plan.md): target users, research traceability, phased plan, demo script, definition of done
- [`initalplan.md`](./initalplan.md): product spec and research brief
- [`DESIGN.md`](./DESIGN.md): brand, mascot and motion
- [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md): rules for AI coding agents

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript strict · Expo Router · expo-sqlite · zustand · LiteRT-LM (Gemma 3 / Qwen 2.5 / Gemma 4) · ML Kit Text Recognition · Tesseract.js · Jest

Unhooked is a self-help tool, not medical, legal or financial advice. In a crisis, call the NCMH Crisis Hotline **1553** or **911**.
