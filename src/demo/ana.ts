// Demo data for the UI phase, following persona Ana (plan.md → Target users).
// Screens read from here until the repositories land (Debt P2, Spend P3, Scroll P4, Insights P5).
// Amounts are display strings on purpose: no math happens on demo data.

export const demoUser = { name: 'Ana' };

export const demoPurchase = {
  item: 'Wireless earbuds',
  price: '₱4,500',
  when: 'Tonight, 11:40 PM · online store',
  leftAfter: '₱1,700',
  leftAfterShare: 0.27,
  conflict: 'Pera Agad wants ₱3,000 on Oct 15. You would be about ₱1,300 short.',
  bnpl: { plan: '6 × ₱899 + ₱150 fee', total: '₱5,544 total', extra: '₱1,044 more (23%)' },
};

export interface DemoDebt {
  name: string;
  sub: string;
  amount: string;
  due: string;
  urgent?: boolean;
  progress: number;
  note: string;
}

export const demoOwe: DemoDebt[] = [
  {
    name: 'Pera Agad',
    sub: 'Online lender',
    amount: '₱3,000',
    due: 'Due Oct 15',
    urgent: true,
    progress: 0.25,
    note: 'Paid ₱1,000 of ₱4,000',
  },
  {
    name: 'Phone installment',
    sub: 'Pay-later plan',
    amount: '₱2,400',
    due: 'Next Oct 22',
    progress: 0.67,
    note: '4 of 6 paid · ₱1,200 each',
  },
  {
    name: 'Tita Baby',
    sub: 'Family loan · no interest',
    amount: '₱2,500',
    due: 'No due date',
    progress: 0.17,
    note: 'Paid ₱500 · pay when able',
  },
];

export const demoOwed: DemoDebt[] = [
  {
    name: 'Jessa',
    sub: 'Lent for tuition',
    amount: '₱1,500',
    due: 'Due Oct 30',
    progress: 0,
    note: 'Draft a polite reminder when it is due',
  },
  {
    name: 'Mark',
    sub: 'Lent for fare',
    amount: '₱300',
    due: 'Due Oct 12',
    urgent: true,
    progress: 0.4,
    note: 'Paid back ₱200 of ₱500',
  },
];

export const demoDebtTotals = { owe: '₱7,900', owed: '₱1,800' };

export const demoScroll = {
  app: 'TikTok',
  elapsed: '21:14',
  minutes: 21,
  limit: 20,
  today: '52 min',
  longest: '21 min',
  weekTotal: '6h 10m',
  peak: '11 PM',
};

export const demoWeekPauses = [1, 2, 0, 3, 2, 4]; // the 6 days before today; today comes from the session store

export const demoInsights = [
  {
    module: 'Scroll',
    color: '#0F5F6E',
    certainty: 'estimate' as const,
    text: 'Your longest sessions start after 11 PM. A gentle reminder at 10:45 might help.',
  },
  {
    module: 'Spend',
    color: '#B8480A',
    certainty: 'fact' as const,
    text: 'You checked 5 purchases this week and saved 2 for later.',
  },
  {
    module: 'Debt',
    color: '#5E3D8C',
    certainty: 'fact' as const,
    text: 'Two repayments land within a week of each other. Planning them together may help.',
  },
];

export const demoMessage = {
  parts: [
    { text: 'PAY NOW', flag: true },
    { text: ' OR ', flag: false },
    { text: 'WE WILL CONTACT YOUR FAMILY', flag: true },
    { text: ' AND ', flag: false },
    { text: 'POST YOUR INFORMATION', flag: true },
    { text: '. ', flag: false },
    { text: 'Last warning today.', flag: true },
    { text: ' Send to ', flag: false },
    { text: 'e-wallet 09XX XXX XXXX', flag: true },
    { text: '.', flag: false },
  ],
  signals: [
    { label: 'Threat', text: 'Says they will contact your family.' },
    { label: 'Exposure', text: 'Threatens to post your personal information.' },
    { label: 'Pressure', text: 'Demands payment now, with a same-day deadline.' },
    { label: 'Payment', text: 'Asks you to send money to a personal e-wallet number.' },
  ],
};

export const pauseCopy = {
  checkout: {
    eyebrow: 'Checkout pause',
    title: 'Before you buy',
    head: 'This one could pinch your repayment.',
    fact: 'Pera Agad: ₱3,000 due Oct 15, in 6 days.',
    estimate: 'After ₱4,500 you would have about ₱1,700 left this cycle.',
    a: 'Save for 24 hours',
    b: 'Show options under ₱2,000',
    c: 'Buy anyway',
  },
  borrow: {
    eyebrow: 'Borrowing pause',
    title: 'Before you borrow ₱2,000',
    head: 'Another loan would stack on top of this month.',
    fact: 'You owe ₱3,000 on Oct 15 and ₱1,200 on Oct 22.',
    estimate: 'With ₱2,000 more, about ₱900 is left for food and fare.',
    a: 'Review what I owe',
    b: 'Ask for a payment plan',
    c: 'Borrow anyway',
  },
} as const;
