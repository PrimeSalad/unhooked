import { assessMessage, highlightParts } from '../messageRisk';

describe('assessMessage', () => {
  it('flags the classic abusive-collector message as high risk', () => {
    const r = assessMessage('PAY NOW OR WE WILL CONTACT YOUR FAMILY AND POST YOUR INFORMATION.');
    expect(r.level).toBe('high');
    expect(r.signals.map((s) => s.label)).toEqual(
      expect.arrayContaining(['Threat', 'Exposure', 'Pressure']),
    );
  });

  it('detects Taglish threats and personal e-wallet numbers', () => {
    const r = assessMessage(
      'Magbayad ka na ngayon din! Ipo-post namin ang litrato mo. Send to GCash 0917 123 4567',
    );
    expect(r.level).toBe('high');
    expect(r.signals.map((s) => s.label)).toEqual(
      expect.arrayContaining(['Pressure', 'Exposure', 'Payment']),
    );
  });

  it('a polite reminder is low with no signals', () => {
    const r = assessMessage('Hi! Friendly reminder that your payment is due on Oct 15. Thank you.');
    expect(r.level).toBe('low');
    expect(r.signals).toHaveLength(0);
  });

  it('always says it is an indication, not proof', () => {
    expect(assessMessage('hello').explanation).toMatch(/indication, not proof/);
    expect(assessMessage('PAY NOW or we will contact your family').explanation).toMatch(
      /indication, not proof/,
    );
  });
});

describe('highlightParts', () => {
  it('rebuilds the original text with flagged spans merged', () => {
    const text = 'PAY NOW or we will contact your family today';
    const parts = highlightParts(text, assessMessage(text).signals);
    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.flag).map((p) => p.text)).toEqual([
      'PAY NOW',
      'we will contact your family',
    ]);
  });
});
