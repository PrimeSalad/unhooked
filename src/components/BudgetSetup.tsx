import { useState } from 'react';

import { View } from 'react-native';
import { Button, Field, Text } from '@/components/ui';
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
  const billsC = parsePesoInput(bills);
  const savingsC = parsePesoInput(savings);
  const valid =
    !!incomeC && (!bills.trim() || billsC !== null) && (!savings.trim() || savingsC !== null);
  return (
    <View
      style={{
        gap: spacing.lg,
        padding: spacing.xl,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
      }}
    >
      <Text variant="heading">Give your budget a starting point.</Text>
      <Text variant="small" color={colors.textMuted}>
        Three rough numbers so I can tell you what a purchase really costs you. Stays on this phone.
      </Text>
      <Field
        label="Monthly income or allowance"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={income}
        onChangeText={setIncome}
        error={income && !incomeC ? 'Enter an amount greater than zero.' : undefined}
      />
      <Field
        label="Fixed bills each month"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={bills}
        onChangeText={setBills}
        error={bills && billsC === null ? 'Enter a valid amount or leave blank.' : undefined}
      />
      <Field
        label="Savings goal each month"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={savings}
        onChangeText={setSavings}
        error={savings && savingsC === null ? 'Enter a valid amount or leave blank.' : undefined}
      />
      <Button
        label="Save budget"
        disabled={!valid}
        onPress={() =>
          incomeC &&
          setBudget({
            monthlyIncome: incomeC,
            monthlyFixedBills: billsC ?? 0,
            savingsGoalMonthly: savingsC ?? 0,
            payday: null,
          })
        }
      />
    </View>
  );
}
