// Privacy Policy and Terms of Use shown before first use (/agree) and from Settings (/legal).
// Every statement must match what the app actually does; update LEGAL_VERSION on any change
// so people are asked to agree again.

export const LEGAL_VERSION = '2026-10-10';
export const LEGAL_CONTACT = 'https://github.com/PrimeSalad/unhooked/issues';

export interface LegalSection {
  heading: string;
  body: string[];
}

/** The few lines people actually read, shown on the agree screen. */
export const LEGAL_SUMMARY = [
  'Your records stay on this phone. There is no account, no cloud AI, no ads and no tracking by us.',
  'The app only goes online when you choose to: downloading the AI or speech model, or opening a link.',
  'AI answers and estimates can be wrong. They are labeled, and you always decide.',
  'Unhooked is not a lender, a lawyer, a doctor or a crisis service. In danger, use Help and safety.',
];

export const PRIVACY_POLICY: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      'Unhooked is a personal wellness app for debt, spending and scrolling, made by the Unhooked team for the AppBuilders hackathon. Questions or requests: ' +
        LEGAL_CONTACT,
    ],
  },
  {
    heading: 'What the app keeps, and where',
    body: [
      'Everything you enter stays in the app’s private storage on this phone: your optional first name, budget, debts and payments (including lender names), purchases, scroll sessions, daily check-ins (stress, mood and tiredness), Evidence Pack items (screenshots, message text, notes), reported and blocked phone numbers, flagged collector calls (number and time), and a log of actions in the app used for your insights.',
      'We, the makers, never receive any of it. There is no Unhooked server, no account and no analytics or advertising SDK.',
      'Ask Ginto conversations are kept only while the chat is open and are not saved.',
      'Android cloud backup is turned off for this app, so your records are not copied to a Google account backup. Use the export buttons if you want a copy.',
    ],
  },
  {
    heading: 'On-device AI',
    body: [
      'Ask Ginto, pause reflections and message checks run a language model (Gemma 4) on this phone. Your words, records and photos are not sent anywhere for AI.',
      'Numbers in answers come from the app’s own calculations, not from the model.',
    ],
  },
  {
    heading: 'When the app uses the internet',
    body: [
      'Only when you choose to: downloading an AI model or the Tagalog speech model from Hugging Face (huggingface.co). Like any website, Hugging Face receives your IP address and basic request details under its own privacy policy. No personal records are sent.',
      'While a website guard is on, the phone’s website lookups (DNS only, not page contents) are answered by Cloudflare 1.1.1.1 or Google Public DNS.',
      'Links to the SEC, hotlines and other official sites open in your browser.',
      'Reading text from photos (receipts, screenshots) uses Google ML Kit on this phone. The photo is not uploaded, but ML Kit sends Google usage and diagnostic data such as device model, app version, image size and error codes.',
      'Files you export (number log, Evidence Pack, complaint draft) go only where you send them with Android’s share sheet.',
    ],
  },
  {
    heading: 'Permissions, and why',
    body: [
      'Microphone: voice input, recognized on this phone. No audio is uploaded or saved.',
      'Photos: only the screenshots or receipts you pick.',
      'Notifications: reminders, scroll check-ins and possible collector call notices.',
      'Usage access and display over other apps: the app guard pause before apps you chose.',
      'VPN: a local, DNS-only filter for websites you chose to guard. Your traffic does not go through us.',
      'Caller ID & spam role (collector calls): the incoming number only, checked against your own lists. Unhooked never hears calls and does not read your call log or SMS.',
      'Every permission is optional and asked for only when you turn on the feature that needs it.',
    ],
  },
  {
    heading: 'Your choices and rights',
    body: [
      'Because your data is on your phone, you can see, correct or delete it in the app at any time. Settings → Delete all my data erases everything; uninstalling the app does too.',
      'This policy is written with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) in mind. You may contact us or the National Privacy Commission with concerns.',
    ],
  },
  {
    heading: 'Age',
    body: ['Unhooked is meant for people 18 and older.'],
  },
  {
    heading: 'Changes',
    body: [
      `Version ${LEGAL_VERSION}. If this policy changes, the app will show it again and ask you to agree before you continue.`,
    ],
  },
];

export const TERMS_OF_USE: LegalSection[] = [
  {
    heading: 'Using Unhooked',
    body: [
      'By tapping Agree you accept these terms and the Privacy Policy. If you do not agree, do not use the app.',
      'Unhooked helps you pause and reflect before borrowing, buying or scrolling. It is a self-help tool. It is not a lender, bank, financial adviser, lawyer, doctor or mental health service, and it does not give professional advice.',
    ],
  },
  {
    heading: 'Estimates, AI and your decisions',
    body: [
      'Budget figures, repayment plans and affordability checks are estimates based on what you enter. AI wording can be wrong or incomplete. Lines are labeled as fact, estimate or suggestion; check important details with official sources before acting.',
      'You make every decision. Unhooked never guarantees an outcome.',
    ],
  },
  {
    heading: 'Safety',
    body: [
      'Unhooked is not an emergency or crisis service. If you or someone else is in danger, call 911 or a hotline listed in Help and safety.',
    ],
  },
  {
    heading: 'Collector calls, blocking and evidence',
    body: [
      'Call screening and blocking work only from the numbers you report or block, only for Philippine mobile numbers, on Android 10 or newer, while Unhooked is your caller ID & spam app. It can miss calls or flag the wrong ones, and a blocked number cannot reach you, so do not rely on it for emergencies.',
      'Notes about calling hours and SEC rules are general information, not a legal finding. Check the SEC’s official rules or get legal advice before filing a complaint.',
      'Report only numbers that actually contacted you. Do not use the number log, shared lists or evidence to harass, threaten or publicly shame anyone.',
    ],
  },
  {
    heading: 'Third-party parts',
    body: [
      'The Gemma models are provided by Google under the Gemma Terms of Use and Prohibited Use Policy (ai.google.dev/gemma/terms), which also apply to how you use them. Model files are downloaded from Hugging Face. Text recognition uses Google ML Kit.',
    ],
  },
  {
    heading: 'Your phone and your data',
    body: [
      'Your records live only on your phone, so keep it locked and export anything you want to keep before deleting data or uninstalling. We cannot recover lost data.',
    ],
  },
  {
    heading: 'No warranty',
    body: [
      'Unhooked is provided as is, without warranties of any kind. To the extent Philippine law allows, the makers are not liable for losses arising from use of the app, including decisions made from its estimates or AI text.',
    ],
  },
  {
    heading: 'Law and changes',
    body: [
      `These terms follow the laws of the Philippines. Version ${LEGAL_VERSION}; if they change, the app will ask you to agree again.`,
    ],
  },
];
