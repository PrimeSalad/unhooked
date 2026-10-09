import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { Button, Field, Row, ScreenHeader, Segmented, Sheet, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { deleteAllData } from '@/db/migrations';
import { bumpData } from '@/db/useDbQuery';
import { parsePesoInput, toPesos } from '@/domain/money';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { isGuardAvailable, syncGuard } from '@/lib/guard';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const PAUSE_OPTIONS = ['5', '10', '15'] as const;
const pesoText = (c: number | undefined) => c === undefined ? '' : String(toPesos(c));

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const s = useSettings();
  const showToast = useSession((state) => state.showToast);
  const action = useAsyncAction();
  const deletion = useAsyncAction('Could not finish deleting your records. Please try again.');
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(s.name);
  const [income, setIncome] = useState(pesoText(s.budget?.monthlyIncome));
  const [bills, setBills] = useState(pesoText(s.budget?.monthlyFixedBills));
  const [savings, setSavings] = useState(pesoText(s.budget?.savingsGoalMonthly));
  const incomeC = parsePesoInput(income);
  const billsC = parsePesoInput(bills);
  const savingsC = parsePesoInput(savings);
  const valid = (!income.trim() || !!incomeC) && (!bills.trim() || billsC !== null) && (!savings.trim() || savingsC !== null) && (!!incomeC || (!bills.trim() && !savings.trim()));

  const saveProfile = () => action.run(async () => {
    if (!valid) return;
    s.setName(name);
    s.setBudget(incomeC ? { monthlyIncome: incomeC, monthlyFixedBills: billsC ?? 0, savingsGoalMonthly: savingsC ?? 0, payday: null } : null);
    showToast('Your profile and budget are saved.');
  });

  const wipe = () => deletion.run(async () => {
    await syncGuard([]);
    await deleteAllData(db);
    s.reset();
    bumpData();
    setConfirming(false);
    router.replace('/welcome');
    showToast('Your local records and preferences have been deleted.');
  });

  return (
    <FlowScreen>
      <ScreenHeader back title="Make it yours." subtitle="Your preferences, your privacy, your pace." />
      <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Text variant="eyebrow">Private by default</Text>
        <Text>Unhooked stores your records on this device. There is no account, bank connection or cloud upload. Clearing browser storage or uninstalling the app can remove these records.</Text>
      </View>

      <FormSection title="You and your month" description="Estimates are enough. These numbers make purchase checks useful.">
        <Field label="First name (optional)" placeholder="What should we call you?" value={name} onChangeText={setName} autoCapitalize="words" maxLength={50} />
        <Field label="Monthly income or allowance (₱)" hint="Leave all budget fields blank to remove your budget." placeholder="0.00" keyboardType="decimal-pad" value={income} onChangeText={setIncome} error={income && !incomeC ? 'Enter a monthly amount greater than zero.' : !income && (bills || savings) ? 'Add your income, or clear all three budget fields.' : undefined} />
        <Field label="Fixed monthly bills (₱)" placeholder="0.00" keyboardType="decimal-pad" value={bills} onChangeText={setBills} error={bills && billsC === null ? 'Enter a valid amount.' : undefined} />
        <Field label="Monthly savings goal (₱)" placeholder="0.00" keyboardType="decimal-pad" value={savings} onChangeText={setSavings} error={savings && savingsC === null ? 'Enter a valid amount.' : undefined} />
        <ActionError message={action.error} />
        <Button label="Save profile" disabled={!valid} loading={action.pending} onPress={() => void saveProfile()} />
      </FormSection>

      <FormSection title="Room to pause" description="Choose the length of your decision pause. Changes save immediately.">
        <Segmented value={String(s.pauseSeconds) as (typeof PAUSE_OPTIONS)[number]} onChange={(value) => void action.run(async () => { s.setPauseSeconds(Number(value)); await syncGuard(await listRules(db)); })} options={PAUSE_OPTIONS.map((value) => ({ value, label: `${value} seconds` }))} />
      </FormSection>

      <FormSection title="App and website guards">
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="strong">Enable guards</Text>
            <Text variant="small">{isGuardAvailable() ? 'Turn off to stop every guard. Your selected apps and websites stay saved.' : 'Guards run in the Android development build. Website lists can be prepared here.'}</Text>
          </View>
          <Switch value={s.guardOn && isGuardAvailable()} disabled={!isGuardAvailable() || action.pending} onValueChange={(value) => void action.run(async () => { const previous = s.guardOn; s.setGuardOn(value); try { await syncGuard(await listRules(db)); } catch (error) { s.setGuardOn(previous); throw error; } })} trackColor={{ true: colors.lagoon, false: colors.track }} thumbColor={colors.white} accessibilityLabel="Enable app and website guards" />
        </Row>
        <Button label="Manage apps and websites" kind="outline" onPress={() => router.push('/scroll')} />
      </FormSection>

      <FormSection title="Your data belongs to you" description="Delete your records, saved evidence and preferences from this device. This cannot be undone.">
        <Button label="Delete all my data" kind="outline" icon="trash" onPress={() => setConfirming(true)} />
      </FormSection>
      <Text variant="caption">Unhooked is a self-help tool. Its estimates support your decisions; they do not replace professional advice.</Text>

      <Sheet open={confirming} onClose={() => { if (!deletion.pending) setConfirming(false); }}>
        <Text variant="heading">Delete everything on this device?</Text>
        <Text>Debts, payments, purchases, check-ins, evidence and preferences will be permanently removed. You will return to the welcome screen.</Text>
        <ActionError message={deletion.error} />
        <Button label="Yes, delete my data" icon="trash" loading={deletion.pending} onPress={() => void wipe()} />
        <Button label="Keep my data" kind="ghost" disabled={deletion.pending} onPress={() => setConfirming(false)} />
      </Sheet>
    </FlowScreen>
  );
}
