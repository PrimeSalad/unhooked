import { useState } from 'react';

import { Button, Card, Field, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { parsePesoInput } from '@/domain/money';
import { useSettings } from '@/store/settings';

/** Three rough numbers so purchases and loans are checked against the user's real month. */
export function BudgetSetup() {
  const setBudget = useSettings((s) => s.setBudget);
  const [income, setIncome] = useState('');
  const [bills, setBills] = useState('');
  const [savings, setSavings] = useState('');
  const incomeC = parsePesoInput(income);
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="strong">First, your month</Text>
      <Text variant="small" color={colors.textMuted}>
        Three rough numbers so I can tell you what a purchase really costs you. Stays on this phone.
      </Text>
      <Field
        label="Monthly income or allowance"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={income}
        onChangeText={setIncome}
      />
      <Field
        label="Fixed bills each month"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={bills}
        onChangeText={setBills}
      />
      <Field
        label="Savings goal each month"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={savings}
        onChangeText={setSavings}
      />
      <Button
        label="Save budget"
        disabled={!incomeC}
        onPress={() =>
          incomeC &&
          setBudget({
            monthlyIncome: incomeC,
            monthlyFixedBills: parsePesoInput(bills) ?? 0,
            savingsGoalMonthly: parsePesoInput(savings) ?? 0,
            payday: null,
          })
        }
      />
    </Card>
  );
}
