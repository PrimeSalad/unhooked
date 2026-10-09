import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { Button, Chips, Field, goBack, Screen, ScreenHeader, Segmented } from '@/components/ui';
import { addDebt, endOfMonthDate } from '@/db/repo';
import { parsePesoInput } from '@/domain/money';
import type { DebtDirection } from '@/domain/types';
import { dateInDays } from '@/lib/format';
import { useSession } from '@/store/session';

type Due = 'week' | 'two' | 'month' | 'none';

const dueDate: Record<Due, () => string | null> = {
  week: () => dateInDays(7),
  two: () => dateInDays(14),
  month: () => endOfMonthDate(),
  none: () => null,
};

export default function NewDebtScreen() {
  const params = useLocalSearchParams<{
    direction?: string;
    amount?: string;
    counterparty?: string;
  }>();
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);

  const [direction, setDirection] = useState<DebtDirection>(
    params.direction === 'lent' ? 'lent' : 'owed',
  );
  const [who, setWho] = useState(params.counterparty ?? '');
  const [amount, setAmount] = useState(params.amount ? String(Number(params.amount) / 100) : '');
  const [due, setDue] = useState<Due>('two');
  const [interest, setInterest] = useState('');
  const [note, setNote] = useState('');

  const principal = parsePesoInput(amount);
  const valid = who.trim().length > 0 && !!principal;
  const lent = direction === 'lent';

  const save = async () => {
    if (!valid || !principal) return;
    const pct = Number(interest);
    await addDebt(db, {
      direction,
      counterparty: who.trim(),
      principal,
      dueDate: dueDate[due](),
      interestRatePct: interest && Number.isFinite(pct) ? pct : null,
      notes: note.trim() || null,
    });
    goBack();
    showToast(
      lent ? 'Saved. I will help you remember.' : 'Saved. I will remind you before it is due.',
    );
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title={lent ? 'Money I lent' : 'Money I owe'}
        mascot={lent ? 'happy' : 'thinking'}
      />
      <Segmented
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'owed', label: 'I owe' },
          { value: 'lent', label: 'Owed to me' },
        ]}
      />
      <Field
        label={lent ? 'Who owes you?' : 'Who do you owe?'}
        placeholder={lent ? 'Friend, family member…' : 'Lending app, bank, person…'}
        value={who}
        onChangeText={setWho}
        autoCapitalize="words"
      />
      <Field
        label={lent ? 'Amount lent' : 'Total to pay back'}
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />
      <Chips<Due>
        value={due}
        onChange={setDue}
        options={[
          { value: 'week', label: 'In 1 week' },
          { value: 'two', label: 'In 2 weeks' },
          { value: 'month', label: 'End of month' },
          { value: 'none', label: 'No due date' },
        ]}
      />
      {!lent && (
        <Field
          label="Interest or fees (%)"
          hint="Optional. Helps me sort which debt costs you the most."
          placeholder="e.g. 15"
          keyboardType="decimal-pad"
          value={interest}
          onChangeText={setInterest}
        />
      )}
      <Field
        label="Note"
        placeholder={lent ? 'For tuition, for fare…' : 'Online lender, pay-later plan…'}
        value={note}
        onChangeText={setNote}
      />
      <Button label="Save" disabled={!valid} onPress={() => void save()} />
    </Screen>
  );
}
