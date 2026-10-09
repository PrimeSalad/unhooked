import { router } from 'expo-router';
import { useState } from 'react';

import { FlowScreen, FormSection } from '@/components/FlowLayout';
import { Button, Field, ScreenHeader, Text } from '@/components/ui';
import { parsePesoInput } from '@/domain/money';
import { useSettings } from '@/store/settings';

export default function BorrowScreen() {
  const [amount, setAmount] = useState('');
  const [lender, setLender] = useState('');
  const seconds = useSettings((s) => s.pauseSeconds);
  const value = parsePesoInput(amount);
  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="Before you borrow."
        subtitle="Make a little room to think before taking on more."
      />
      <FormSection
        title="What are you considering?"
        description="We’ll put this amount next to your recorded repayments and monthly budget."
      >
        <Field
          label="Amount to borrow (₱)"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          error={amount && !value ? 'Enter an amount greater than zero.' : undefined}
        />
        <Field
          label="Lender or person (optional)"
          placeholder="Who would you borrow from?"
          value={lender}
          onChangeText={setLender}
          maxLength={100}
        />
      </FormSection>
      <Button
        label={`Take a ${seconds}-second pause`}
        icon="arrow-forward"
        disabled={!value}
        onPress={() => {
          if (value)
            router.replace({
              pathname: '/pause',
              params: { kind: 'borrow', amount: String(value), lender: lender.trim() },
            });
        }}
      />
      <Text variant="caption">
        This does not apply for a loan or save a debt. You choose what happens next.
      </Text>
    </FlowScreen>
  );
}
