import type { Evidence } from './types';

export interface EvidencePdfItem {
  evidence: Evidence;
  imageDataUri: string | null;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return replacements[character] ?? character;
  });

export function isValidIncidentDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** No network assets or scripts; user-entered notes and messages are HTML-escaped. */
export function buildEvidencePdfHtml(items: EvidencePdfItem[], generatedAt = new Date()): string {
  const sorted = [...items].sort(
    (a, b) =>
      a.evidence.lender.localeCompare(b.evidence.lender) ||
      b.evidence.incidentDate.localeCompare(a.evidence.incidentDate),
  );
  const dates = sorted.map(({ evidence }) => evidence.incidentDate.slice(0, 10)).sort();
  const dateRange = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No dates';
  let currentLender = '';
  const entries = sorted
    .map(({ evidence, imageDataUri }) => {
      const lenderHeading =
        evidence.lender === currentLender ? '' : `<h2>${escapeHtml(evidence.lender)}</h2>`;
      currentLender = evidence.lender;
      const image =
        imageDataUri && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(imageDataUri)
          ? `<img src="${imageDataUri}" alt="Saved screenshot" />`
          : evidence.imageUri
            ? '<p>Screenshot file unavailable for this export.</p>'
            : '';
      return `${lenderHeading}<article><p class="date">${escapeHtml(evidence.incidentDate.slice(0, 10))}</p>
        ${evidence.note ? `<p><strong>Note:</strong> ${escapeHtml(evidence.note)}</p>` : ''}
        ${evidence.messageText ? `<p class="message">${escapeHtml(evidence.messageText)}</p>` : ''}
        ${image}</article>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    @page { margin: 24px; } body { font-family: Arial, sans-serif; color: #2A1608; line-height: 1.45; }
    .cover { min-height: 80vh; padding-top: 70px; page-break-after: always; }
    h1 { color: #C4450B; font-size: 32px; } h2 { border-bottom: 2px solid #FF6B1A; padding-bottom: 6px; }
    article { border: 1px solid #ddd; padding: 14px; margin: 14px 0; page-break-inside: avoid; }
    .date { font-weight: bold; } .message { white-space: pre-wrap; overflow-wrap: anywhere; }
    img { max-width: 100%; max-height: 650px; object-fit: contain; }
    .notice { background: #FFF6EC; padding: 14px; }
  </style></head><body><section class="cover"><h1>Unhooked Evidence Pack</h1>
    <p>Generated ${escapeHtml(generatedAt.toISOString().slice(0, 10))}</p>
    <p>${sorted.length} saved record${sorted.length === 1 ? '' : 's'} · Incident dates: ${escapeHtml(dateRange)}</p>
    <p class="notice">This pack contains user-saved records. It is not a legal finding or proof of wrongdoing.
    Review dates and details before sharing. Keep a copy in a safe place.</p></section>
    ${entries}</body></html>`;
}
