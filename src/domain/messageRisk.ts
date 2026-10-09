// Rule-based suspicious message / harassment detector. Runs fully on the device.
// The result is an *indication*, never proof. Every flag is explainable: it points at the text.

import type { RiskLevel } from './types';

export interface Signal {
  label: 'Threat' | 'Exposure' | 'Pressure' | 'Payment' | 'Shaming';
  explanation: string;
  /** [start, end) offsets into the original text. */
  spans: [number, number][];
}

export interface MessageRisk {
  level: RiskLevel;
  signals: Signal[];
  explanation: string;
}

const RULES: { label: Signal['label']; explanation: string; patterns: RegExp[]; weight: number }[] =
  [
    {
      label: 'Threat',
      explanation: 'Threatens you, your family or your contacts.',
      weight: 3,
      patterns: [
        /\b(we|i) will (contact|call|message|visit|text) (your )?(family|relatives|friends|contacts|employer|boss|office)\b/gi,
        /\b(kontakin|tatawagan|ite-text|pupuntahan) (namin|ka|ang) [^.!?\n]{0,30}(pamilya|kamag-anak|kaibigan|amo|trabaho)/gi,
        /\b(kill|hurt|harm|patayin|sasaktan)\b/gi,
        /\b(police|pulis|kulong|kakasuhan|demanda|warrant|arrest)\b/gi,
      ],
    },
    {
      label: 'Exposure',
      explanation: 'Threatens to post or share your personal information.',
      weight: 3,
      patterns: [
        /\b(post|publish|share|expose|spread) (your )?(info(rmation)?|photo|picture|name|details|id)\b/gi,
        /\b(ipo-?post|ikakalat|ipapakalat|ilalabas) [^.!?\n]{0,30}(info|litrato|picture|pangalan|mukha)/gi,
        /\b(facebook|social media|group chat|gc)\b/gi,
      ],
    },
    {
      label: 'Shaming',
      explanation: 'Uses insults or public shaming.',
      weight: 2,
      patterns: [/\b(scammer|magnanakaw|thief|walang hiya|manloloko|estafa)\b/gi],
    },
    {
      label: 'Pressure',
      explanation: 'Demands payment right away or sets a short deadline.',
      weight: 1,
      patterns: [
        /\b(pay now|pay today|immediately|last warning|final notice|within \d+ (hours?|hrs?|minutes?))\b/gi,
        /\b(magbayad ka na|bayaran mo na|ngayon din|huling babala|today only)\b/gi,
      ],
    },
    {
      label: 'Payment',
      explanation: 'Asks you to send money to a personal account, number or link.',
      weight: 2,
      patterns: [
        /\b(send|transfer|pay|ipadala|i-send) [^.!?\n]{0,20}(to|sa) [^.!?\n]{0,20}(gcash|maya|e-?wallet|account|number)\b/gi,
        /\b09\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
        /\bhttps?:\/\/\S+|\bbit\.ly\/\S+/gi,
      ],
    },
  ];

export function assessMessage(text: string): MessageRisk {
  const signals: Signal[] = [];
  let score = 0;
  for (const rule of RULES) {
    const spans: [number, number][] = [];
    for (const re of rule.patterns) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        if (m.index !== undefined) spans.push([m.index, m.index + m[0].length]);
      }
    }
    if (spans.length) {
      signals.push({ label: rule.label, explanation: rule.explanation, spans });
      score += rule.weight;
    }
  }
  // All-caps shouting adds a little pressure on its own.
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) score += 1;

  const level: RiskLevel = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  const explanation =
    level === 'low'
      ? 'No strong warning signs found. This is an indication, not proof.'
      : `Found ${signals.length} warning ${signals.length === 1 ? 'sign' : 'signs'}. This is an indication, not proof.`;
  return { level, signals, explanation };
}

/** Splits text into plain and flagged parts for highlighting. */
export function highlightParts(text: string, signals: Signal[]): { text: string; flag: boolean }[] {
  const spans = signals
    .flatMap((s) => s.spans)
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((merged, s) => {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
      return merged;
    }, []);
  const parts: { text: string; flag: boolean }[] = [];
  let i = 0;
  for (const [a, b] of spans) {
    if (a > i) parts.push({ text: text.slice(i, a), flag: false });
    parts.push({ text: text.slice(a, b), flag: true });
    i = b;
  }
  if (i < text.length) parts.push({ text: text.slice(i), flag: false });
  return parts;
}
