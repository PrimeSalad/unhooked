// Draft complaint about a lending app, for the user to review, sign and file with the SEC.
// A draft only: nothing is sent from the app.

import { escapeHtml } from './evidence';
import { formatPHP, type Centavos } from './money';
import type { Signal } from './messageRisk';

export interface ComplaintInput {
  lender: string;
  amount: Centavos | null;
  dueDate: string | null;
  secReg: string | null;
  caNumber: string | null;
  signals: Signal['label'][];
  messageText: string;
  evidenceCount: number;
}

const WHAT: Record<Signal['label'], string> = {
  Threat: 'threatened me or the people I know',
  Exposure: 'threatened to shame me or expose my debt to my contacts',
  Pressure: 'used pressure and false urgency to make me pay',
  Payment: 'asked me to send money to a personal account or number',
  Shaming: 'insulted or shamed me',
};

export function buildSecComplaintHtml(c: ComplaintInput, now = new Date()): string {
  const date = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const acts = [...new Set(c.signals)].map((s) => `<li>The collector ${WHAT[s]}.</li>`).join('');
  const row = (k: string, v: string | null) =>
    `<tr><td>${k}</td><td>${v ? escapeHtml(v) : '<i>Not shown</i>'}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:Helvetica,Arial,sans-serif;color:#2A1608;font-size:12pt;line-height:1.5;margin:40px}
h1{font-size:16pt;margin:0 0 4px} .muted{color:#7a6a5c;font-size:10pt}
table{border-collapse:collapse;width:100%;margin:12px 0} td{border:1px solid #e6dccf;padding:6px 8px;vertical-align:top}
td:first-child{width:38%;color:#7a6a5c} blockquote{border-left:3px solid #e6dccf;margin:8px 0;padding:4px 12px;white-space:pre-wrap}
.blank{border-bottom:1px solid #2A1608;display:inline-block;min-width:220px}
</style></head><body>
<p class="muted">DRAFT · Review, complete and sign before filing</p>
<h1>Complaint against a lending company</h1>
<p>${escapeHtml(date)}</p>
<p>To: Securities and Exchange Commission (Philippines)</p>
<p>I am filing a complaint against <b>${escapeHtml(c.lender)}</b> for unfair debt collection practices, which are prohibited under SEC Memorandum Circular No. 18, Series of 2019.</p>
<h2 style="font-size:13pt">Loan details</h2>
<table>
${row('Lender or app name', c.lender)}
${row('Amount demanded', c.amount ? formatPHP(c.amount) : null)}
${row('Due date', c.dueDate)}
${row('SEC registration number shown', c.secReg)}
${row('Certificate of Authority number shown', c.caNumber)}
</table>
<h2 style="font-size:13pt">What happened</h2>
${acts ? `<ul>${acts}</ul>` : '<p class="blank">&nbsp;</p>'}
${c.messageText.trim() ? `<p>One of the messages I received:</p><blockquote>${escapeHtml(c.messageText.trim().slice(0, 1500))}</blockquote>` : ''}
<p>Attached: ${c.evidenceCount > 0 ? `${c.evidenceCount} saved record${c.evidenceCount === 1 ? '' : 's'} from my Evidence Pack` : 'screenshots of the messages'}.</p>
<h2 style="font-size:13pt">What I am asking for</h2>
<p>That the Commission investigate this company and stop the harassment.</p>
<p style="margin-top:28px">Name: <span class="blank">&nbsp;</span></p>
<p>Contact number or email: <span class="blank">&nbsp;</span></p>
<p>Signature: <span class="blank">&nbsp;</span></p>
<p class="muted" style="margin-top:28px">Prepared with Unhooked. Check the SEC website for the current way to file a complaint.</p>
</body></html>`;
}
