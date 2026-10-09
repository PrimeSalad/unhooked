import { contextSummary, findAmount, localReply, type ChatContext } from '../chat';

// Mirrors db/repo's emptyOverview without pulling expo-sqlite into the test.
const emptyOverview: ChatContext['overview'] = {
  debts: [],
  owedTotal: 0,
  lentTotal: 0,
  dueThisMonth: 0,
  nextDue: null,
  cooling: [],
  spentThisMonth: 0,
  scroll: {
    todayMinutes: 0,
    longestToday: 0,
    weekMinutes: 0,
    longestWeek: 0,
    weekSessions: 0,
    peakHour: null,
    byPartOfDay: { night: 0, morning: 0, afternoon: 0, evening: 0 },
    breaksWeek: 0,
  },
  dodgedToday: 0,
  breaksToday: 0,
  evidence: { count: 0, lenders: 0 },
  checkIn: null,
};

const ctx = (over: Partial<ChatContext> = {}): ChatContext => ({
  name: 'Ana',
  budget: {
    monthlyIncome: 2_200_000,
    monthlyFixedBills: 1_200_000,
    savingsGoalMonthly: 100_000,
    payday: '15_30',
  },
  overview: { ...emptyOverview, owedTotal: 750_000, dueThisMonth: 300_000 },
  ...over,
});

describe('localReply intents', () => {
  it('matches whole words only, so "spend it" is not a crisis and "Lazada" is not sadness', () => {
    expect(localReply('Should I spend it on shoes?', ctx())).not.toMatch(/1553|NCMH/);
    expect(localReply('Should I buy this on Lazada for ₱1,200?', ctx())).toMatch(/^Estimate:/);
    expect(localReply('Can I lower my power bill?', ctx())).not.toMatch(/You owe/);
    expect(localReply('Need new headphones', ctx())).not.toMatch(/tracked|Start a session/);
  });

  it('still routes real crisis and stress phrases to help', () => {
    expect(localReply('I want to end it all', ctx())).toMatch(/1553/);
    expect(localReply('Ang pagod ko na sa utang', ctx())).toMatch(/heavy/);
  });

  it('answers the demo suggestions from the records', () => {
    expect(localReply('Can I afford ₱1,500?', ctx())).toMatch(/^Estimate:/);
    expect(localReply('What do I owe this month?', ctx())).toMatch(/₱7,500/);
    expect(localReply('Should I borrow ₱2,000?', ctx())).toMatch(/already owe ₱7,500/);
    expect(localReply('How much did I scroll today?', ctx())).toMatch(/No scrolling tracked/);
  });
});

describe('findAmount', () => {
  it('prefers the marked peso amount over other numbers', () => {
    expect(findAmount('Can I afford 2 of these for ₱1,500?')).toBe(150_000);
    expect(findAmount('kaya ko ba ang 2k na sapatos')).toBe(200_000);
    expect(findAmount('PHP 450.50 lang')).toBe(45_050);
    expect(findAmount('no numbers here')).toBeNull();
  });
});

describe('contextSummary', () => {
  it('names the lender but never includes notes or message text', () => {
    const summary = contextSummary(
      ctx({
        overview: {
          ...emptyOverview,
          nextDue: {
            debt: {
              id: 'd1',
              direction: 'owed',
              counterparty: 'SuperLoan Collections',
              principal: 500_000,
              interestRatePct: null,
              dueDate: '2026-10-15',
              terms: null,
              notes: 'threatened me',
              createdAt: '2026-10-01',
              closedAt: null,
            },
            paid: 0,
            outstanding: 500_000,
            progress: 0,
          },
        },
      }),
    );
    expect(summary).not.toMatch(/threatened/);
    expect(summary).toMatch(/₱5,000 to SuperLoan Collections on 2026-10-15/);
  });
});
