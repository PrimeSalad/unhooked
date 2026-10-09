import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import {
  Button,
  Card,
  Field,
  Group,
  GroupRow,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  Tag,
  Text,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { logEventAndRefresh } from '@/db/events';
import { emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { planRepayment, type RepaymentStrategy } from '@/domain/repayment';
import { dueLabel } from '@/lib/format';

const options: { value: RepaymentStrategy; label: string }[] = [
  { value: 'due_date', label: 'Due dates' },
  { value: 'avalanche', label: 'High cost' },
  { value: 'snowball', label: 'Small first' },
];

export default function RepaymentPlanScreen() {
  const db = useSQLiteContext();
  const { data: overview } = useDbQuery(getOverview, emptyOverview);
  const [budgetText, setBudgetText] = useState('');
  const [strategy, setStrategy] = useState<RepaymentStrategy>('due_date');
  const [shown, setShown] = useState(false);
  const budget = parsePesoInput(budgetText);
  const plan = shown && budget ? planRepayment(overview.debts, budget, strategy) : null;

  const showPlan = () => {
    if (!budget) return;
    setShown(true);
    void logEventAndRefresh(db, 'repayment_plan_viewed', { strategy, monthlyBudget: budget });
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Repayment plan"
        subtitle="A starting point from the balances you recorded."
        mascot="thinking"
      />
      <Field
        label="How much can you put toward debt each month?"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={budgetText}
        onChangeText={(value) => {
          setBudgetText(value);
          setShown(false);
        }}
      />
      <Segmented
        value={strategy}
        onChange={(value) => {
          setStrategy(value);
          setShown(false);
        }}
        options={options}
      />
      <Text variant="small" color={colors.textMuted}>
        Due dates goes by the date you entered. High cost starts with the highest entered interest
        rate. Small first starts with the lowest balance.
      </Text>
      <Button label="Show my plan" disabled={!budget || !overview.owedTotal} onPress={showPlan} />

      {plan ? (
        <>
          <Card style={{ gap: spacing.md }}>
            <Tag certainty="estimate" />
            <Text variant="heading">
              {plan.months === 1 ? 'About 1 month' : `About ${plan.months} months`} to clear
            </Text>
            <Text variant="small">
              {formatPHP(plan.totalOutstanding)} recorded balance ÷ {formatPHP(budget ?? 0)} per
              month. Future interest, fees and new borrowing are not included.
            </Text>
            {plan.warning ? (
              <Text variant="small" color={colors.textSoft}>
                {plan.warning}
              </Text>
            ) : null}
          </Card>
          <Section title="Suggested order">
            <Group>
              {plan.ordered.map((balance, index) => {
                const firstMonth = plan.firstMonth.find((item) => item.debtId === balance.debt.id);
                return (
                  <GroupRow
                    key={balance.debt.id}
                    title={`${index + 1}. ${balance.debt.counterparty}`}
                    subtitle={`${dueLabel(balance.debt.dueDate)} · ${formatPHP(balance.outstanding)} open${firstMonth ? ` · ${formatPHP(firstMonth.amount)} this month` : ''}`}
                  />
                );
              })}
            </Group>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
