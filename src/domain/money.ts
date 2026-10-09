// Money is stored as integer centavos to avoid floating-point drift.
// Convert at the edges only (input parsing and display).

export type Centavos = number;

export function toCentavos(pesos: number): Centavos {
  return Math.round(pesos * 100);
}

export function toPesos(c: Centavos): number {
  return c / 100;
}

/** Parses user input like "4,500", "₱4500.50", " 12 " into centavos. Returns null if invalid. */
export function parsePesoInput(raw: string): Centavos | null {
  const cleaned = raw.replace(/[₱,\s]/g, '');
  if (cleaned === '' || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return toCentavos(Number(cleaned));
}

const php = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatPHP(c: Centavos): string {
  return php.format(toPesos(c));
}
