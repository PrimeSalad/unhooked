import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { CLOUD_URL } from '@/ai/chat';
import { Button, Card, Field, Row, Screen, ScreenHeader, Segmented, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { deleteAllData } from '@/db/migrations';
import { loadDemoData } from '@/db/seed';
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

  const saveProfile = () => {
    s.setName(name);
    const incomeC = parsePesoInput(income);
    s.setBudget(
      incomeC
        ? {
            monthlyIncome: incomeC,
            monthlyFixedBills: parsePesoInput(bills) ?? 0,
            savingsGoalMonthly: parsePesoInput(savings) ?? 0,
            payday: null,
          }
        : null,
    );
    showToast('Saved.');
  };

  const enableCloud = (on: boolean) => {
    if (!on) return s.setCloudAi(false);
    const msg =
      'Ginto will send your questions and a numbers-only summary (totals, due dates, minutes) to Claude through your Ginto server. Names of lenders, messages and screenshots never leave this phone.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(msg)) s.setCloudAi(true);
      return;
    }
    Alert.alert('Use Claude for Ask Ginto?', msg, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Turn on', onPress: () => s.setCloudAi(true) },
    ]);
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
          server, unless you turn on Claude below.
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
        <Button label="Save" size="sm" onPress={saveProfile} />
      </Card>

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
            <Text variant="strong">Smarter Ask Ginto (Claude)</Text>
            <Text variant="caption">
              {CLOUD_URL
                ? 'Off by default. Only numbers are shared.'
                : 'Needs a Ginto server. See README.'}
            </Text>
          </View>
          <Switch
            value={s.cloudAiEnabled}
            disabled={!CLOUD_URL}
            onValueChange={enableCloud}
            trackColor={{ true: colors.primary, false: colors.track }}
            thumbColor={colors.white}
            accessibilityLabel="Use Claude for Ask Ginto"
          />
        </Row>
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

      {__DEV__ && (
        <Button
          label="Load demo data (Ana)"
          kind="outline"
          size="sm"
          onPress={async () => {
            await loadDemoData(db);
            await syncGuard(await listRules(db));
            router.dismissTo('/');
            showToast('Demo loaded: Ana, 3 debts, a cooling purchase, a week of scrolling.');
          }}
        />
      )}

      <Button label="Delete all my data" kind="ghost" icon="trash" onPress={confirmDelete} />
    </Screen>
  );
}
