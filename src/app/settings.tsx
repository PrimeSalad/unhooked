import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { deleteAllData } from '@/db/migrations';
import { useSettings } from '@/store/settings';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const resetSettings = useSettings((s) => s.reset);

  const confirmDelete = () =>
    Alert.alert('Delete all data?', 'This permanently removes every record on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAllData(db);
          resetSettings();
        },
      },
    ]);

  return (
    <Screen>
      <Card>
        <Text variant="heading">Your data stays on this phone</Text>
        <Text variant="muted">
          Debts, purchases, screenshots and check-ins are stored only on this device. Nothing is
          sent to a server unless you turn on cloud features, and we will tell you before that
          happens.
        </Text>
      </Card>
      <Button label="Delete all my data" onPress={confirmDelete} kind="secondary" />
    </Screen>
  );
}
