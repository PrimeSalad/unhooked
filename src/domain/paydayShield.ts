// Payday Shield: when a shopping app opens, show the user's own money facts. Pure.

import { dailyAllowance, daysUntil, nextPayday } from './allowance';
import type { Centavos } from './money';
import type { BudgetProfile } from './types';

const SHOPPING = ['shopee', 'lazada', 'tiktok', 'zalora', 'temu', 'shein', 'aliexpress', 'amazon'];

export function isShoppingApp(pkg?: string, label?: string): boolean {
  const s = `${pkg ?? ''} ${label ?? ''}`.toLowerCase();
  return SHOPPING.some((k) => s.includes(k));
}

/** 10 PM to 4 AM: when most impulse buys happen. */
export function isLateNight(now = new Date()): boolean {
  const h = now.getHours();
  return h >= 22 || h < 4;
}

export interface ShieldMoney {
  perDay: Centavos;
  free: Centavos;
  days: number;
  payday: Date;
}

export function shieldMoney(
  budget: BudgetProfile,
  spentThisMonth: Centavos,
  dueThisMonth: Centavos,
  now = new Date(),
): ShieldMoney {
  const available = budget.monthlyIncome - budget.monthlyFixedBills - budget.savingsGoalMonthly;
  const free = available - spentThisMonth - dueThisMonth;
  const payday = nextPayday(budget.payday, now);
  const days = daysUntil(payday, now);
  return { perDay: dailyAllowance(free, days), free, days, payday };
}
