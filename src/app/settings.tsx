import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Platform } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Segmented, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { deleteAllData } from '@/db/migrations';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const PAUSE_OPTIONS = ['5', '10', '15'] as const;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const pauseSeconds = useSettings((s) => s.pauseSeconds);
  const setPauseSeconds = useSettings((s) => s.setPauseSeconds);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const resetSettings = useSettings((s) => s.reset);
  const showToast = useSession((s) => s.showToast);

  const wipe = async () => {
    await deleteAllData(db);
    resetSettings();
    router.dismissTo('/');
    showToast('All your data was deleted from this phone.');
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
          Debts, purchases, screenshots and check-ins are stored only on this device. Nothing is
          sent to a server unless you turn on cloud features, and I will tell you before that
          happens.
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text variant="strong">Pause length</Text>
        <Text variant="small" color={colors.textMuted}>
          The real delay is what helps. Ten seconds is the default.
        </Text>
        <Segmented
          value={String(pauseSeconds) as (typeof PAUSE_OPTIONS)[number]}
          onChange={(v) => setPauseSeconds(Number(v))}
          options={PAUSE_OPTIONS.map((v) => ({ value: v, label: `${v} s` }))}
        />
      </Card>

      <Button
        label="Show the welcome again"
        kind="outline"
        onPress={() => {
          setOnboarded(false);
          router.dismissTo('/');
        }}
      />
      <Button
        label="Delete all my data"
        kind="ghost"
        icon="trash-outline"
        onPress={confirmDelete}
      />
    </Screen>
  );
}
