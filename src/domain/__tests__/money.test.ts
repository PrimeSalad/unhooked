import { formatPHP, parsePesoInput, toCentavos } from '../money';

describe('money', () => {
  it('converts pesos to integer centavos', () => {
    expect(toCentavos(4500)).toBe(450000);
    expect(toCentavos(0.1 + 0.2)).toBe(30);
  });

  it('parses common peso inputs', () => {
    expect(parsePesoInput('4,500')).toBe(450000);
    expect(parsePesoInput('₱ 1,234.5')).toBe(123450);
    expect(parsePesoInput('abc')).toBeNull();
    expect(parsePesoInput('')).toBeNull();
    expect(parsePesoInput('1.234')).toBeNull();
  });

  it('formats as PHP', () => {
    expect(formatPHP(450000)).toContain('4,500');
  });
});
