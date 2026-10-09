import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Screen, ScreenHeader, Text } from '@/components/ui';
import { colors } from '@/constants/theme';
import { parsePesoInput } from '@/domain/money';

/** Trigger for the borrowing pause: how much, from whom. */
export default function BorrowScreen() {
  const [amount, setAmount] = useState('');
  const [lender, setLender] = useState('');
  const value = parsePesoInput(amount);

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Thinking of borrowing?" mascot="worried" />
      <Text variant="small" color={colors.textMuted}>
        No judgment. Let us look at it together for ten seconds before you sign anything.
      </Text>
      <Field
        label="How much?"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
      />
      <Field
        label="From whom? (optional)"
        placeholder="Lending app, person…"
        value={lender}
        onChangeText={setLender}
      />
      <Button
        label="Pause with me"
        disabled={!value}
        onPress={() =>
          value &&
          router.replace({
            pathname: '/pause',
            params: { kind: 'borrow', amount: String(value), lender: lender.trim() },
          })
        }
      />
    </Screen>
  );
}
