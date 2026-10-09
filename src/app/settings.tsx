import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { AgentModelCard } from '@/components/chat/AgentModelCard';
import {
  Button,
  Card,
  Field,
  Group,
  GroupRow,
  Row,
  Screen,
  ScreenHeader,
  Segmented,
  Text,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { deleteAllData } from '@/db/migrations';
import { isGuardAvailable, syncGuard } from '@/lib/guard';
import { bumpData } from '@/db/useDbQuery';
import { parsePesoInput, toPesos } from '@/domain/money';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const PAUSE_OPTIONS = ['5', '10', '15'] as const;
const pesoText = (c: number | undefined) => (c ? String(toPesos(c)) : '');

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const s = useSettings();
  const showToast = useSession((st) => st.showToast);

  const [name, setName] = useState(s.name);
  const [income, setIncome] = useState(pesoText(s.budget?.monthlyIncome));
  const [bills, setBills] = useState(pesoText(s.budget?.monthlyFixedBills));
  const [savings, setSavings] = useState(pesoText(s.budget?.savingsGoalMonthly));
  const [paySchedule, setPaySchedule] = useState<'monthly' | 'twice'>(
    s.budget?.payday === '15_30' ? 'twice' : 'monthly',
  );

  const saveProfile = () => {
    s.setName(name);
    const incomeC = parsePesoInput(income);
    s.setBudget(
      incomeC
        ? {
            monthlyIncome: incomeC,
            monthlyFixedBills: parsePesoInput(bills) ?? 0,
            savingsGoalMonthly: parsePesoInput(savings) ?? 0,
            payday:
              paySchedule === 'twice'
                ? '15_30'
                : typeof s.budget?.payday === 'number'
                  ? s.budget.payday
                  : null,
          }
        : null,
    );
    showToast('Saved.');
  };

  const wipe = async () => {
    try {
      await deleteAllData(db);
      await syncGuard([]);
      bumpData();
      s.reset();
      router.dismissTo('/');
      showToast('All your data was deleted from this phone.');
    } catch {
      showToast('Some data could not be removed. Please try again.');
    }
  };

  const confirmDelete = () => {
    const msg = 'This permanently removes every record on this device.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(msg)) void wipe();
      return;
    }
    Alert.alert('Delete all data?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void wipe() },
    ]);
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Privacy and settings" mascot="brave" />

      <Card tone={colors.shell} flat>
        <Text variant="strong">Your data stays on this phone</Text>
        <Text variant="small">
          Debts, purchases, screenshots and check-ins are stored only on this device. No account, no
          server.
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="strong">You and your month</Text>
        <Field label="Name" placeholder="Optional" value={name} onChangeText={setName} />
        <Field
          label="Monthly income or allowance"
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={income}
          onChangeText={setIncome}
        />
        <Field
          label="Fixed bills each month"
          hint="Do not include debts already tracked in Debt."
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
        <Text variant="small">When do you get paid?</Text>
        <Segmented
          value={paySchedule}
          onChange={setPaySchedule}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'twice', label: '15th & 30th' },
          ]}
        />
        <Button label="Save" size="sm" onPress={saveProfile} />
      </Card>

      {Platform.OS === 'android' ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="strong">Microphone and reminders</Text>
          <Text variant="small">
            Voice stays on this phone. Reminders use discreet wording, and both can stay off.
          </Text>
          <Button
            label="Review permissions"
            kind="ghost"
            size="sm"
            onPress={() => router.push('/permissions')}
          />
        </Card>
      ) : null}

      <AgentModelCard />

      <Card style={{ gap: spacing.md }}>
        <Text variant="strong">Pause length</Text>
        <Text variant="small" color={colors.textMuted}>
          The real delay is what helps. Ten seconds is the default.
        </Text>
        <Segmented
          value={String(s.pauseSeconds) as (typeof PAUSE_OPTIONS)[number]}
          onChange={(v) => s.setPauseSeconds(Number(v))}
          options={PAUSE_OPTIONS.map((v) => ({ value: v, label: `${v} s` }))}
        />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="strong">App and website guards</Text>
            <Text variant="caption">
              {isGuardAvailable()
                ? 'Turn off to stop every guard right away.'
                : 'Runs in the Android app. Set up guards in Scroll.'}
            </Text>
          </View>
          <Switch
            value={s.guardOn}
            onValueChange={async (v) => {
              s.setGuardOn(v);
              await syncGuard(await listRules(db));
            }}
            trackColor={{ true: colors.lagoon, false: colors.track }}
            thumbColor={colors.white}
            accessibilityLabel="App and website guards"
          />
        </Row>
      </Card>

      <Group>
        <GroupRow
          icon="help"
          title="Help and safety"
          subtitle="Hotlines and where to report"
          onPress={() => router.push('/help')}
        />
      </Group>

      <Button label="Delete all my data" kind="ghost" icon="trash" onPress={confirmDelete} />
    </Screen>
  );
}
