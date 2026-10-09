// Tiny multinomial Naive Bayes text classifier trained from curated English and
// Taglish examples. Training and inference both happen in memory on the device.
// Exact rules in messageRisk.ts remain as an explainable safety net and highlighter.

export type MessageClass = 'safe' | 'pressure' | 'harassment' | 'phishing';

export interface MessageClassification {
  category: MessageClass;
  confidence: number;
  probabilities: Record<MessageClass, number>;
  matchedTokens: string[];
  modelVersion: 'ginto-message-nb-v1';
}

const TRAINING: Record<MessageClass, string[]> = {
  safe: [
    'Friendly reminder that your payment is due on Friday thank you',
    'We received your payment and updated your account',
    'Your monthly statement is ready in the official app',
    'Please contact customer support if you need a payment arrangement',
    'Reminder lang po due date mo next week salamat',
    'Your balance is available in your account no action required today',
  ],
  pressure: [
    'Pay now today this is your final warning',
    'Immediate payment required within one hour',
    'Magbayad ka ngayon din huling babala',
    'Bayaran mo na within two hours no excuses',
    'You must settle today or face consequences',
    'Last chance pay immediately before the deadline',
  ],
  harassment: [
    'We will contact your family friends and employer',
    'Ipo post namin ang picture at pangalan mo sa Facebook',
    'Ipapahiya ka namin sa lahat ng kakilala mo',
    'Walang hiya magnanakaw manloloko ka',
    'We will shame you in every group chat',
    'Pupuntahan ka namin at tatawagan ang pamilya mo',
  ],
  phishing: [
    'Send payment to this personal GCash number now',
    'Click this link to verify your account and avoid suspension',
    'Transfer the balance to our new personal account',
    'I send sa Maya number na ito ang bayad',
    'Open the link and enter your password to confirm payment',
    'Pay through this shortened link bit ly immediately',
  ],
};

const CLASSES = Object.keys(TRAINING) as MessageClass[];

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
  const bigrams = words.slice(1).map((word, index) => `${words[index]}_${word}`);
  return [...words, ...bigrams];
}

function train() {
  const vocabulary = new Set<string>();
  const counts = {} as Record<MessageClass, Map<string, number>>;
  const totals = {} as Record<MessageClass, number>;

  for (const category of CLASSES) {
    const bag = new Map<string, number>();
    let total = 0;
    for (const example of TRAINING[category]) {
      for (const token of tokenize(example)) {
        vocabulary.add(token);
        bag.set(token, (bag.get(token) ?? 0) + 1);
        total += 1;
      }
    }
    counts[category] = bag;
    totals[category] = total;
  }
  return { vocabulary, counts, totals };
}

const MODEL = train();

export function classifyMessageLocally(text: string): MessageClassification {
  const tokens = tokenize(text);
  const known = tokens.filter((token) => MODEL.vocabulary.has(token));
  const scores = {} as Record<MessageClass, number>;

  for (const category of CLASSES) {
    const denominator = MODEL.totals[category] + MODEL.vocabulary.size;
    scores[category] = Math.log(1 / CLASSES.length);
    for (const token of tokens) {
      scores[category] += Math.log(((MODEL.counts[category].get(token) ?? 0) + 1) / denominator);
    }
  }

  const max = Math.max(...CLASSES.map((category) => scores[category]));
  const exp = Object.fromEntries(
    CLASSES.map((category) => [category, Math.exp(scores[category] - max)]),
  ) as Record<MessageClass, number>;
  const sum = CLASSES.reduce((total, category) => total + exp[category], 0);
  const probabilities = Object.fromEntries(
    CLASSES.map((category) => [category, exp[category] / sum]),
  ) as Record<MessageClass, number>;
  const category = [...CLASSES].sort((a, b) => probabilities[b] - probabilities[a])[0] ?? 'safe';

  const distinctMatches = [...new Set(known)]
    .map((token) => {
      const categoryRate =
        ((MODEL.counts[category].get(token) ?? 0) + 1) /
        (MODEL.totals[category] + MODEL.vocabulary.size);
      const safeRate =
        ((MODEL.counts.safe.get(token) ?? 0) + 1) / (MODEL.totals.safe + MODEL.vocabulary.size);
      return { token, lift: Math.log(categoryRate / safeRate) };
    })
    .filter((item) => item.lift > 0.2)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 4)
    .map((item) => item.token.replace('_', ' '));

  return {
    category,
    confidence: Math.round(probabilities[category] * 100) / 100,
    probabilities,
    matchedTokens: distinctMatches,
    modelVersion: 'ginto-message-nb-v1',
  };
}
