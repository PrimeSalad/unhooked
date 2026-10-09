import { useSettings } from '../settings';
import { settingsStorage } from '../storage';

jest.mock('../storage', () => {
  const values = new Map<string, string>();
  return {
    settingsStorage: {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: jest.fn((key: string) => {
        values.delete(key);
      }),
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  useSettings.getState().reset();
});

it('restores an unfinished setup and its exact inputs from persisted storage', async () => {
  await useSettings.getState().updateOnboardingDraft({
    step: 2,
    name: 'Mika',
    focus: 'spend',
    income: '25,000',
    bills: '8000.50',
  });
  const persisted = await settingsStorage.getItem('unhooked-settings');
  useSettings.getState().reset();
  await settingsStorage.setItem('unhooked-settings', persisted!);
  await useSettings.persist.rehydrate();
  expect(useSettings.getState().onboardingDraft).toMatchObject({
    step: 2,
    name: 'Mika',
    focus: 'spend',
    income: '25,000',
    bills: '8000.50',
  });
  expect(useSettings.getState().onboarded).toBe(false);
});

it('completes setup with real preferences while preserving an existing budget when skipped', async () => {
  const budget = {
    monthlyIncome: 2500000,
    monthlyFixedBills: 800000,
    savingsGoalMonthly: 200000,
    payday: 15,
  };
  useSettings.getState().setBudget(budget);
  await useSettings.getState().updateOnboardingDraft({ step: 3, focus: 'scroll' });
  await useSettings
    .getState()
    .completeOnboarding({ name: ' Mika ', focus: 'scroll', scrollLimitMinutes: 30 });
  await useSettings.persist.rehydrate();
  expect(useSettings.getState()).toMatchObject({
    onboarded: true,
    name: 'Mika',
    focus: 'scroll',
    budget,
    scrollLimitMinutes: 30,
  });
  expect(useSettings.getState().onboardingDraft.step).toBe(0);
});

it('retains the editable draft and restores prior preferences after a failed completion write', async () => {
  await useSettings
    .getState()
    .updateOnboardingDraft({ step: 3, name: 'Mika', focus: 'debt', income: '25,000' });
  jest
    .mocked(settingsStorage.setItem)
    .mockImplementationOnce(() => Promise.reject(new Error('Storage unavailable')));
  await expect(
    useSettings.getState().completeOnboarding({ name: 'Mika', focus: 'debt' }),
  ).rejects.toThrow('Storage unavailable');
  expect(useSettings.getState()).toMatchObject({
    onboarded: false,
    name: '',
    focus: null,
    onboardingDraft: { step: 3, name: 'Mika', focus: 'debt', income: '25,000' },
  });
});

it('makes existing installations revisitable without losing their saved budget and name', async () => {
  await settingsStorage.setItem(
    'unhooked-settings',
    JSON.stringify({
      version: 0,
      state: {
        onboarded: true,
        name: 'Ana',
        budget: {
          monthlyIncome: 3000000,
          monthlyFixedBills: 1000000,
          savingsGoalMonthly: 500000,
          payday: null,
        },
        scrollLimitMinutes: 45,
      },
    }),
  );
  await useSettings.persist.rehydrate();
  expect(useSettings.getState().onboardingDraft).toMatchObject({
    step: 0,
    name: 'Ana',
    income: '30000',
    bills: '10000',
    savings: '5000',
    scrollLimit: '45',
  });
});
