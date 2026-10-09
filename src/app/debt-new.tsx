import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { Button, Chips, Field, goBack, ScreenHeader, Segmented, Text } from '@/components/ui';
import { addDebt, endOfMonthDate } from '@/db/repo';
import { parsePesoInput } from '@/domain/money';
import type { DebtDirection } from '@/domain/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { dateInDays } from '@/lib/format';
import { useSession } from '@/store/session';

type Due = 'week' | 'two' | 'month' | 'none';
const dueDate: Record<Due, () => string | null> = {
  week: () => dateInDays(7), two: () => dateInDays(14), month: () => endOfMonthDate(), none: () => null,
};

export default function NewDebtScreen() {
  const params = useLocalSearchParams<{ direction?: string; amount?: string; counterparty?: string }>();
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const action = useAsyncAction();
  const [direction, setDirection] = useState<DebtDirection>(params.direction === 'lent' ? 'lent' : 'owed');
  const [who, setWho] = useState(params.counterparty ?? '');
  const [amount, setAmount] = useState(params.amount ? String(Number(params.amount) / 100) : '');
  const [due, setDue] = useState<Due>('two');
  const [interest, setInterest] = useState('');
  const [note, setNote] = useState('');
  const principal = parsePesoInput(amount);
  const lent = direction === 'lent';
  const interestValid = lent || !interest.trim() || (/^\d+(\.\d{1,2})?$/.test(interest) && Number(interest) >= 0);
  const valid = who.trim().length > 0 && !!principal && interestValid;

  const save = () => action.run(async () => {
    if (!valid || !principal) return;
    await addDebt(db, { direction, counterparty: who.trim(), principal, dueDate: dueDate[due](), interestRatePct: !lent && interest.trim() ? Number(interest) : null, notes: note.trim() || null });
    goBack();
    showToast('Record saved. You can track the balance in Debt.');
  });

  return (
    <FlowScreen>
      <ScreenHeader back title={lent ? 'Money you lent.' : 'A clearer picture of what you owe.'} subtitle="One record at a time. Everything stays on this device." />
      <Segmented value={direction} onChange={setDirection} options={[{ value: 'owed', label: 'I owe' }, { value: 'lent', label: 'Owed to me' }]} />
      <FormSection title="The essentials">
        <Field label={lent ? 'Who owes you?' : 'Who do you owe?'} placeholder="Person, bank or lending app" value={who} onChangeText={setWho} autoCapitalize="words" maxLength={100} />
        <Field label={lent ? 'Amount lent (₱)' : 'Total to pay back (₱)'} hint={lent ? 'The full amount you lent.' : 'Include any interest or fees already agreed.'} placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} error={amount && !principal ? 'Enter an amount greater than zero, with up to two decimal places.' : undefined} />
      </FormSection>
      <FormSection title="When is it due?" description="Choose an approximate date, or leave it open.">
        <Chips<Due> value={due} onChange={setDue} options={[{ value: 'week', label: 'In 1 week' }, { value: 'two', label: 'In 2 weeks' }, { value: 'month', label: 'End of month' }, { value: 'none', label: 'No due date' }]} />
      </FormSection>
      <FormSection title="A little context" description="Optional details for your own reference.">
        {!lent && <Field label="Interest or fees (%)" hint="Used to prioritize higher-cost debts. This does not add fees to the total above." placeholder="e.g. 15" keyboardType="decimal-pad" value={interest} onChangeText={setInterest} error={!interestValid ? 'Use a positive percentage or leave this blank.' : undefined} />}
        <Field label="Note" placeholder="What would help you remember?" value={note} onChangeText={setNote} multiline maxLength={500} />
      </FormSection>
      <ActionError message={action.error} />
      <Button label="Save record" icon="check" disabled={!valid} loading={action.pending} onPress={() => void save()} />
      <Text variant="caption">No lender is contacted. This is your personal record.</Text>
    </FlowScreen>
  );
}
