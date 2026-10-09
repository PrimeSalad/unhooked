// Help & Safety directory. Only list official/verified services.
// ⚠️ Every entry must be re-verified against the official source before any demo or release
// (plan.md Phase 6 task "Verify resources"). Set `verifiedOn` when you do.

export interface SupportResource {
  name: string;
  purpose: 'crisis' | 'mental_health' | 'debt_harassment' | 'lending_complaint' | 'privacy';
  contact: string; // phone / URL as displayed
  dial?: string; // tel: target
  url?: string;
  verifiedOn: string | null; // ISO date when a human last checked the official source
}

export const SUPPORT_RESOURCES: SupportResource[] = [
  {
    name: 'NCMH Crisis Hotline',
    purpose: 'crisis',
    contact: '1553 (landline, nationwide) · 0917-899-8727',
    dial: '1553',
    verifiedOn: null,
  },
  {
    name: 'Emergency (PNP / Fire / Medical)',
    purpose: 'crisis',
    contact: '911',
    dial: '911',
    verifiedOn: null,
  },
  {
    name: 'SEC – complaints vs. online lending apps',
    purpose: 'lending_complaint',
    contact: 'sec.gov.ph',
    url: 'https://www.sec.gov.ph',
    verifiedOn: null,
  },
  {
    name: 'PNP Anti-Cybercrime Group',
    purpose: 'debt_harassment',
    contact: 'acg.pnp.gov.ph',
    url: 'https://acg.pnp.gov.ph',
    verifiedOn: null,
  },
  {
    name: 'National Privacy Commission',
    purpose: 'privacy',
    contact: 'privacy.gov.ph',
    url: 'https://privacy.gov.ph',
    verifiedOn: null,
  },
];

export const DISCLAIMER =
  'Unhooked is a self-help tool. It is not a substitute for professional medical, legal, or financial advice. Numbers shown are estimates based on what you entered.';
