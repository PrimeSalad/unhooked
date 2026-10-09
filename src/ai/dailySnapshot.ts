import type { Overview } from '@/db/repo';
import type { BudgetProfile } from '@/domain/types';

import { inferDailyPressure } from './localDecisionModel';

export function buildDailyInference(
  overview: Overview,
  budget: BudgetProfile | null,
  scrollLimitMinutes: number,
) {
  return inferDailyPressure({
    monthlyIncome: budget?.monthlyIncome ?? 0,
    monthlyFixedBills: budget?.monthlyFixedBills ?? 0,
    savingsGoalMonthly: budget?.savingsGoalMonthly ?? 0,
    owedTotal: overview.owedTotal,
    dueThisMonth: overview.dueThisMonth,
    scrollMinutesToday: overview.scroll.todayMinutes,
    scrollLimitMinutes,
    coolingCount: overview.cooling.length,
    checkIn: overview.checkIn,
  });
}
