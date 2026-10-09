import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NumberLogCard } from '@/components/NumberLogCard';
import { Button, Card, EmptyState, Field, ScreenHeader, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import {
  addNumberReports,
  importNumberReports,
  listNumberReports,
  removeNumberReports,
} from '@/db/numberReports';
import { useDbQuery } from '@/db/useDbQuery';
import { isValidIncidentDate } from '@/domain/evidence';
import { normalizeMobile, summarizeNumbers } from '@/domain/numberLog';
import { localDateKey } from '@/lib/dateOnly';
import { exportNumberLog, pickNumberLog } from '@/lib/numberLogTransfer';
import { useSession } from '@/store/session';

export default function NumberLogScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const showToast = useSession((state) => state.showToast);
  const { data: reports, loaded } = useDbQuery(listNumberReports, []);
  const summaries = useMemo(() => summarizeNumbers(reports), [reports]);
  const [adding, setAdding] = useState(false);
  const [number, setNumber] = useState('');
  const [agentName, setAgentName] = useState('');
  const [seenOn, setSeenOn] = useState(() => localDateKey(new Date()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!normalizeMobile(number) || !isValidIncidentDate(seenOn) || busy) return;
    setBusy(true);
    try {
      await addNumberReports(db, [{ number, agentName, seenOn, note }]);
      setNumber('');
      setAgentName('');
      setSeenOn(localDateKey(new Date()));
      setNote('');
      setAdding(false);
      showToast('Number added to your private log.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add this number.');
    } finally {
      setBusy(false);
    }
  };

  const importLog = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickNumberLog();
      if (!picked) return;
      const added = await importNumberReports(db, picked);
      showToast(
        added ? `Added ${added} reports. Existing reports were skipped.` : 'No new reports to add.',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import the log.');
    } finally {
      setBusy(false);
    }
  };

  const exportLog = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await exportNumberLog(reports);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not export the log.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (selectedNumber: string) => {
    const run = () => {
      void removeNumberReports(db, selectedNumber)
        .then(() => showToast('Number removed from your log.'))
        .catch(() => showToast('Could not remove this number.'));
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Remove ${selectedNumber} from your log?`)) run();
    } else {
      Alert.alert('Remove number?', `Remove all saved reports for ${selectedNumber}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: run },
      ]);
    }
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={summaries}
      keyExtractor={(item) => item.number}
      renderItem={({ item }) => (
        <NumberLogCard summary={item} onRemove={() => remove(item.number)} />
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.xl,
        paddingBottom: insets.bottom + spacing.xxxl,
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, marginBottom: spacing.lg }}>
          <ScreenHeader
            back
            title="Reported numbers"
            subtitle="Numbers you chose to flag from evidence or enter yourself."
            mascot="thinking"
          />
          <Card tone={colors.surfaceMuted} flat style={{ gap: spacing.xs }}>
            <Text variant="small">
              A number or agent name in a screenshot is only a clue. This log is your own record,
              not proof of spam or the caller’s identity.
            </Text>
            <Text variant="caption">
              Newest sightings appear first. Nothing is uploaded by this screen.
            </Text>
          </Card>
          <Button
            label={adding ? 'Hide form' : 'Add a number'}
            onPress={() => setAdding(!adding)}
          />
          {adding ? (
            <Card style={{ gap: spacing.md }}>
              <Field
                label="Mobile number"
                placeholder="09xx xxx xxxx or +63 9xx xxx xxxx"
                keyboardType="phone-pad"
                value={number}
                onChangeText={setNumber}
              />
              <Field
                label="Agent name (optional, unverified)"
                value={agentName}
                onChangeText={setAgentName}
              />
              <Field label="Date seen (YYYY-MM-DD)" value={seenOn} onChangeText={setSeenOn} />
              <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
              <Button
                label="Save reported number"
                disabled={!normalizeMobile(number) || !isValidIncidentDate(seenOn) || busy}
                onPress={() => void add()}
              />
            </Card>
          ) : null}
          {Platform.OS !== 'web' ? (
            <Card style={{ gap: spacing.sm }}>
              <Text variant="strong">Move this log to another phone</Text>
              <Text variant="small">
                Export a JSON file, then import it on the other phone. It contains reported numbers,
                dates, names and notes only; screenshots and message text stay here.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Import JSON"
                  kind="outline"
                  disabled={busy}
                  onPress={() => void importLog()}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Export JSON"
                  kind="outline"
                  disabled={busy || !reports.length}
                  onPress={() => void exportLog()}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}
          {summaries.length ? <Text variant="heading">Recent numbers</Text> : null}
        </View>
      }
      ListEmptyComponent={
        loaded ? (
          <EmptyState
            mood="curious"
            title="No numbers reported yet"
            body="Read a screenshot in Evidence Pack and choose a number to log, or add one here."
          />
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
