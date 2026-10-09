# Unhooked

> **Judges:** start with [**SUBMISSION.md**](./SUBMISSION.md). It maps every judging criterion to the feature and the code that proves it.

**Pause. Understand. Decide.** Unhooked is an Android app for Filipinos juggling online loans, pay-later installments and late-night doomscrolling. When one of those hooks pulls, it steps in with a **real 10-second pause** and a reflection **written on the phone by an on-device language model from the user's own records**. The user always makes the final call.

- **Everything runs on the phone.** On-device language models (LiteRT-LM), on-device speech (Whisper), on-device OCR (ML Kit). There is no cloud AI and no account.
- **Built for one person first:** Ana, 24, a BPO agent on a budget Android phone with three online loans and two SPayLater plans, paid on the 15th and 30th ([plan.md → Target users](./plan.md#target-users)).
- **Tested:** `npm run check` runs TypeScript strict mode, ESLint and **119 Jest tests in 23 suites**.

---

## Why

Debt, impulse pay-later spending and doomscrolling feed each other, and the people affected rarely ask for help:

- **47,446** online-lending-app complaints to PAOCC (Aug 2024 – Jan 2026), mostly harassment and contact-shaming.
- The average BNPL purchase is about **42% of monthly income**; Filipinos spend about **4.8 h/day** on social media.
- Debt is linked to depression (OR **2.77**); only **2.2–17.5%** of Filipinos with mental-health problems seek help, mostly because of cost and stigma.

Sources and how each one maps to a feature: [plan.md §4](./plan.md#4-research--feature-traceability-for-judges).

---

## Features

### The AI Pause (core loop)

`Trigger → 10-second pause → reflection from your records → you decide`

- Shown before **checking out** (Spend → Check a purchase), **borrowing** (Debt → Before you borrow) and **scrolling** (Scroll). The choices unlock only after the countdown.
- The reflection uses the user's own numbers, for example what is still owed and what is due before payday. The app computes those numbers; the on-device model only rewords them.
- The card says where the words came from: _Phrased on this phone · <model> on <NPU/GPU/CPU> · <seconds>_.
- Code: [`src/app/pause.tsx`](./src/app/pause.tsx), [`src/ai/pausePhrasing.ts`](./src/ai/pausePhrasing.ts), [`src/ai/guard.ts`](./src/ai/guard.ts), [`src/domain/pauseFacts.ts`](./src/domain/pauseFacts.ts)

### Today

- Hooks dodged this week, what is coming up, one insight worth a look, quick actions.
- **Daily check-in:** mood, stress and tiredness in three taps; Ginto's tone gets gentler on hard days. **Check-in history** shows a 7-day mood line.
- **Your week:** patterns from the user's own activity, each labeled _From your records_, _Estimate_ or _Suggestion_.
- **Unhooked Wrapped:** a shareable 7-day summary (kept by waiting, repaid, hooks dodged, scrolling).

### Debt

- Track what you owe and what you are owed, with due-date reminders and a **repayment plan** (by due date, highest cost or smallest first).
- **Utang Scanner:** add a loan-app screenshot; it fills in lender, amount and due date, says whether an SEC registration and Certificate of Authority number are shown, flags collector threats, saves them as evidence and drafts an SEC complaint PDF. It never says a lender is legit; it reports what the screenshot shows and links to the SEC.
- **Scan a message:** paste a collector's text; threats, shaming and exposure are highlighted and explained (English and Taglish).
- **Evidence Pack:** screenshots and messages kept on the phone, exported as a dated PDF when the user is ready to report.
- **Reported numbers:** a local log of collector numbers that can be moved between phones as a file.

### Spend

- **Safe to spend per day** until the next payday, from income, bills, savings, purchases and repayments due.
- **Check a purchase:** affordability and the true cost of a BNPL plan before checkout, then the checkout pause.
- **24-hour cooling off** for anything the user decides to wait on, with a reminder.
- **Payday Shield:** when a guarded shopping app (Shopee, Lazada, TikTok Shop, Temu, SHEIN) opens, the shield shows safe-to-spend per day, the next debt due and what is cooling off, with _Save to wishlist for 24h_.

### Scroll

- **Unhook timer:** pause guarded apps for 15 minutes to 2 hours.
- **App and website guards** (Android): the user picks installed apps or adds websites; opening one shows a pause first. _Open anyway_ is always available after the countdown.
- **Doomscroll fade:** after a set number of minutes in a guarded app, the screen slowly washes out.
- **Breaks:** a short offline idea instead of another scroll.

### Ask Ginto

- A chat about the user's own budget, debts, purchases and scrolling, by **text, voice (Tagalog, Taglish or English) or photo**.
- Rules compute the answer; the on-device model phrases it. Crisis wording skips every model and returns the NCMH hotline and 911.

### Help and safety

- NCMH Crisis Hotline 1553, 911, SEC, PNP Anti-Cybercrime Group and the National Privacy Commission, one tap from Today, Debt and Settings ([details below](#help-and-safety-resources)).

---

## How the local AI works

| Part           | What runs on the phone                                                                                                                                                                        | Code                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language model | Qwen 3 0.6B (~500 MB, 3–4 GB RAM), Qwen 2.5 1.5B (~1.6 GB, 4–6 GB RAM), Gemma 4 E2B (~2.6 GB, 6 GB+ RAM, reads photos), Gemma 4 E4B (~3.7 GB, 8 GB+ RAM, reads photos), through **LiteRT-LM** | [`modules/ginto-local-ai`](./modules/ginto-local-ai), [`src/ai/localModels.ts`](./src/ai/localModels.ts), [`src/ai/androidLocalAi.ts`](./src/ai/androidLocalAi.ts)  |
| Hardware       | Tries the **NPU**, then the **GPU**, then the **CPU**; the user can pin a processor and choose a Balanced or Max mode in Ask Ginto → model settings                                           | [`GintoLocalAiModule.kt`](./modules/ginto-local-ai/android/src/main/java/expo/modules/gintolocalai/GintoLocalAiModule.kt)                                           |
| Model choice   | `recommendLocalModel` reads total and free RAM, low-memory state, battery and free storage, and suggests the model that fits                                                                  | [`src/ai/localModels.ts`](./src/ai/localModels.ts)                                                                                                                  |
| Speech         | Whisper small (int8, ~375 MB) through sherpa-onnx                                                                                                                                             | [`WhisperSpeech.kt`](./modules/ginto-local-ai/android/src/main/java/expo/modules/gintolocalai/WhisperSpeech.kt), [`src/ai/speechModel.ts`](./src/ai/speechModel.ts) |
| OCR            | Google ML Kit on Android; Tesseract.js in the browser                                                                                                                                         | [`src/lib/ocr.ts`](./src/lib/ocr.ts), [`src/lib/ocr.web.ts`](./src/lib/ocr.web.ts)                                                                                  |
| Rules          | Explainable patterns for collector threats and SEC numbers; all money math                                                                                                                    | [`src/domain`](./src/domain)                                                                                                                                        |

**Rules compute, the model phrases.** Every amount comes from tested code in `src/domain` (money is integer centavos). The model only rewords those facts, and [`src/ai/guard.ts`](./src/ai/guard.ts) rejects any output that contains a number the app did not compute or a shaming word, keeping the plain template instead. The pause uses a fresh one-shot conversation every time, so chat history never leaks into it.

**It never blocks on the model.** The template appears instantly; the model's wording replaces it when it is ready. Inference has a 20-second timeout (90 seconds to start a model, 60 seconds for a photo), and the model is warmed at launch ([`src/hooks/useWarmLocalModel.ts`](./src/hooks/useWarmLocalModel.ts)).

**What breaks without local AI:** the pause falls back to fixed templates; Ask Ginto answers keywords only, with no voice and no photos; Scan a message keeps the rule flags but loses the plain-language explanation; screenshots have to be typed by hand.

```
Trigger → src/domain computes facts → template (instant)
        → on-device model rewords it during the countdown
        → guard.ts checks every number and word → use it, or keep the template
        → user decides → event log (SQLite) → Insights
```

---

## Where it runs

|                                                   | Android development build | Expo Go                 | Web preview           |
| ------------------------------------------------- | ------------------------- | ----------------------- | --------------------- |
| Debt, Spend, Scroll, pauses, check-ins, Help      | Yes                       | Yes                     | Yes                   |
| On-device language model, voice input             | Yes                       | No (template answers)   | No (template answers) |
| Screenshot reading (Utang Scanner, Evidence Pack) | ML Kit                    | No (paste text instead) | Tesseract.js          |
| App and website guards, Payday Shield             | Yes                       | Preview only            | Preview only          |
| Evidence Pack PDF                                 | Yes                       | Yes                     | No (phone only)       |
| SEC complaint draft                               | Yes                       | Yes                     | Browser print dialog  |

## Getting started

Requires Node 20+.

```bash
npm install
npm run check          # typecheck + lint + 119 tests
npx expo run:android   # full app on a phone or emulator (development build)
npm start              # Expo Go
npm run web            # web preview
```

**Run a model on the phone**

1. Install the development build (`npx expo run:android`).
2. Open **Ask Ginto → model settings**. It shows the phone's RAM and the recommended model. Tap **Download**; downloads continue in the background.
3. Open a pause (for example Spend → Check a purchase). The card shows the model and processor that wrote the reflection.
4. Turn on airplane mode and try again. Once a model is downloaded, nothing needs the network.

**Turn on guards (Android)**

Open **Scroll → Guards**, pick apps or add websites, and allow _Usage access_ and _Display over other apps_ when asked. Guards use only those user-granted permissions, an overlay and a local DNS-only VPN; there is no Accessibility service and no `QUERY_ALL_PACKAGES` ([plan.md → Phase 4B](./plan.md#phase-4b--app--website-blocking-android-only-dev-build)).

| Script           | Purpose                               |
| ---------------- | ------------------------------------- |
| `npm run check`  | Typecheck, lint and tests (must pass) |
| `npm test`       | Jest only                             |
| `npm run doctor` | `expo-doctor` dependency checks       |

---

## Project structure

```
src/
  app/          Expo Router screens: (tabs) Today/Debt/Spend/Scroll, pause, shield, chat, scan,
                message-check, evidence-pack, number-log, check-in, wrapped, help, settings
  domain/       Pure TypeScript rules and math, unit-tested: money, affordability, bnpl, repayment,
                allowance, paydayShield, utangScan, messageRisk, blocking, wellness, evidence, numberLog
  ai/           Model bridge and picker, speech model, pause phrasing, output guard, chat, insights
  db/           SQLite migrations, repositories, append-only event log
  lib/          OCR, notifications, PDF export, number-log import/export, guard sync
  components/   UI kit, Ginto the goldfish (12 moods), countdown ring
modules/
  ginto-local-ai/   Kotlin: LiteRT-LM engine (NPU → GPU → CPU), Whisper speech, device inspection
  unhooked-guard/   Kotlin: usage-events foreground service, shield deep link, DNS-only VpnService
```

## Rules every feature follows

| #   | Rule                                      | In code                                                                                  |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| R1  | The pause is a real delay                 | [`src/app/pause.tsx`](./src/app/pause.tsx) keeps the choices locked for the pause length |
| R2  | Local-first                               | SQLite on the device; no cloud AI; the only downloads are ones the user starts           |
| R3  | Every derived line is labeled             | _From your records_, _Estimate_ or _Suggestion_ on each line                             |
| R4  | No shame, no guarantees, the user decides | [`src/ai/guard.ts`](./src/ai/guard.ts) filters; _Continue_ is always offered             |
| R5  | Crisis wording bypasses models            | Ask Ginto returns a fixed hotline reply before any model runs                            |
| R6  | The AI never does math                    | `src/domain` computes; `src/ai` only phrases                                             |

---

## Privacy and network

Records, chats, voice and photos stay on the device. These are the only times the app or its build reaches the network:

| Service                                                                                                                | Used for                               | When                                                                      |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| [Hugging Face](https://huggingface.co/litert-community) (`litert-community`)                                           | Downloading a language model           | Only when the user taps **Download** in Ask Ginto → model settings        |
| [Hugging Face](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small) (`sherpa-onnx-whisper-small`)              | Downloading the speech model (~375 MB) | Only when the user sets up voice input; audio is transcribed on the phone |
| [GitHub releases](https://github.com/k2-fsa/sherpa-onnx/releases) (sherpa-onnx)                                        | Speech runtime library                 | At Android build time only                                                |
| [jsDelivr](https://www.jsdelivr.com/package/npm/tesseract.js) (Tesseract.js files)                                     | Screenshot reader on web               | The first scan on web; the screenshot is read in the browser              |
| [Cloudflare 1.1.1.1](https://one.one.one.one/) and [Google Public DNS](https://developers.google.com/speed/public-dns) | Upstream DNS for the website guard     | Only while a website guard is on; DNS lookups only                        |
| [SEC Philippines](https://www.sec.gov.ph) and the help links                                                           | Opening an official website            | Only when the user taps a link                                            |

## Help and safety resources

The in-app **Help & safety** screen (`/help`, one tap from Today, Debt and Settings) lists these services. The list lives in [`src/constants/resources.ts`](./src/constants/resources.ts); each entry must be checked against the official source before a demo or release.

| Service                                                      | For                                                  | Contact                                         |
| ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| NCMH Crisis Hotline                                          | Crisis and mental-health support                     | **1553** (landline, nationwide) · 0917-899-8727 |
| Emergency                                                    | Police, fire, medical                                | **911**                                         |
| [Securities and Exchange Commission](https://www.sec.gov.ph) | Complaints about lending apps                        | sec.gov.ph                                      |
| [PNP Anti-Cybercrime Group](https://acg.pnp.gov.ph)          | Debt-collection harassment, threats, contact-shaming | acg.pnp.gov.ph                                  |
| [National Privacy Commission](https://privacy.gov.ph)        | Misuse of your contacts or personal data             | privacy.gov.ph                                  |

Ask Ginto skips every model when it detects crisis wording and replies with the NCMH hotline and 911.

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
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/), [expo-crypto](https://docs.expo.dev/versions/latest/sdk/crypto/), [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), [expo-clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/), [expo-document-picker](https://docs.expo.dev/versions/latest/sdk/document-picker/) (number-log import)
- [expo-device](https://docs.expo.dev/versions/latest/sdk/device/), [expo-constants](https://docs.expo.dev/versions/latest/sdk/constants/), [expo-linking](https://docs.expo.dev/versions/latest/sdk/linking/), [expo-font](https://docs.expo.dev/versions/latest/sdk/font/), [expo-status-bar](https://docs.expo.dev/versions/latest/sdk/status-bar/), [expo-build-properties](https://docs.expo.dev/versions/latest/sdk/build-properties/)
- [@react-native-community/datetimepicker](https://github.com/react-native-datetimepicker/datetimepicker)

**On-device AI and text reading**

- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM) (`com.google.ai.edge.litertlm:litertlm-android`), the Android runtime for the chat model
- Models from [litert-community on Hugging Face](https://huggingface.co/litert-community): [Qwen 3 0.6B](https://huggingface.co/litert-community/Qwen3-0.6B), [Qwen 2.5 1.5B Instruct](https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct), [Gemma 4 E2B IT](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm), [Gemma 4 E4B IT](https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm) (Gemma models under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms))
- [@react-native-ml-kit/text-recognition](https://github.com/a7med-mahmoud/react-native-ml-kit) wrapping [Google ML Kit Text Recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2)
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) running [Whisper small](https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small) for on-device voice input
- [Tesseract.js](https://github.com/naptha/tesseract.js) for screenshot reading on web

**Design**

- [Poppins](https://fonts.google.com/specimen/Poppins) via [@expo-google-fonts/poppins](https://github.com/expo/google-fonts) (SIL Open Font License)
- [Lucide](https://lucide.dev/) icons via [lucide-react-native](https://github.com/lucide-icons/lucide/tree/main/packages/lucide-react-native)
- [@expo/vector-icons](https://docs.expo.dev/guides/icons/)

**Developer tools**

- [TypeScript](https://www.typescriptlang.org/), [ESLint](https://eslint.org/) with [eslint-config-expo](https://github.com/expo/expo/tree/main/packages/eslint-config-expo), [Prettier](https://prettier.io/)
- [Jest](https://jestjs.io/) with [jest-expo](https://github.com/expo/expo/tree/main/packages/jest-expo) and [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)

## Project docs

- [`SUBMISSION.md`](./SUBMISSION.md): the app mapped to the judging criteria
- [`plan.md`](./plan.md): target users, research traceability, phases, demo script
- [`initalplan.md`](./initalplan.md): original product spec and research brief
- [`DESIGN.md`](./DESIGN.md): brand, mascot and motion
- [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md): rules for AI coding agents

---

Unhooked is a self-help tool, not medical, legal or financial advice. In a crisis, call the NCMH Crisis Hotline **1553** or **911**.
