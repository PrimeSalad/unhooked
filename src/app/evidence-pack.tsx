import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Image, Platform, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  Group,
  GroupRow,
  IconButton,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { addEvidence, deleteEvidence, listEvidence } from '@/db/evidence';
import { useDbQuery } from '@/db/useDbQuery';
import { isValidIncidentDate } from '@/domain/evidence';
import type { Evidence } from '@/domain/types';
import { exportEvidencePack } from '@/lib/evidenceExport';
import { useSession } from '@/store/session';

function todayLocal(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function EvidencePackScreen() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const db = useSQLiteContext();
  const showToast = useSession((state) => state.showToast);
  const { data: items } = useDbQuery(listEvidence, [] as Evidence[]);
  const [adding, setAdding] = useState(add === '1');
  const [picked, setPicked] = useState<{ uri: string; mimeType: string | null } | null>(null);
  const [lender, setLender] = useState('');
  const [incidentDate, setIncidentDate] = useState(todayLocal);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setPicked({ uri: asset.uri, mimeType: asset.mimeType ?? null });
    } catch {
      showToast('Could not open your images. Please try again.');
    }
  };

  const save = async () => {
    if (!picked || !lender.trim() || !isValidIncidentDate(incidentDate) || busy) return;
    setBusy(true);
    try {
      await addEvidence(db, {
        lender,
        incidentDate,
        note,
        imageUri: picked.uri,
        imageMimeType: picked.mimeType,
      });
      setAdding(false);
      setPicked(null);
      setLender('');
      setNote('');
      setIncidentDate(todayLocal());
      showToast('Screenshot saved privately on this phone.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the screenshot.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (item: Evidence) => {
    const remove = () => {
      void deleteEvidence(db, item.id)
        .then(() => showToast('Evidence record deleted.'))
        .catch((error: unknown) =>
          showToast(error instanceof Error ? error.message : 'Could not delete this record.'),
        );
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete this saved record?')) remove();
      return;
    }
    Alert.alert('Delete saved record?', 'The app copy of its screenshot will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  const groups = new Map<string, Evidence[]>();
  for (const item of items) {
    const key = `${item.lender} · ${item.incidentDate.slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Evidence Pack"
        subtitle="Screenshots and messages stay on this device until you choose to share them."
        mascot="brave"
      />
      {Platform.OS === 'web' ? (
        <Card tone={colors.surfaceMuted} flat>
          <Text variant="small">
            Save screenshots in the Android or iPhone app. Saved messages can still appear here.
          </Text>
        </Card>
      ) : (
        <Button
          label={adding ? 'Hide form' : 'Add a screenshot'}
          onPress={() => setAdding(!adding)}
        />
      )}
      {adding && Platform.OS !== 'web' ? (
        <Card style={{ gap: spacing.md }}>
          <Text variant="strong">Save a screenshot</Text>
          <Button
            label={picked ? 'Choose a different image' : 'Choose image'}
            kind="outline"
            onPress={() => void chooseScreenshot()}
          />
          {picked ? (
            <Image
              source={{ uri: picked.uri }}
              style={{ width: '100%', height: 150, resizeMode: 'contain' }}
            />
          ) : null}
          <Field
            label="Lender or sender"
            placeholder="Name on the screenshot"
            value={lender}
            onChangeText={setLender}
          />
          <Field
            label="Incident date (YYYY-MM-DD)"
            placeholder="2026-10-09"
            value={incidentDate}
            onChangeText={setIncidentDate}
            keyboardType="numbers-and-punctuation"
          />
          {incidentDate && !isValidIncidentDate(incidentDate) ? (
            <Text variant="caption" color={colors.error}>
              Enter a real date as YYYY-MM-DD.
            </Text>
          ) : null}
          <Field
            label="Note (optional)"
            placeholder="What happened?"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Button
            label={busy ? 'Saving…' : 'Save to Evidence Pack'}
            disabled={!picked || !lender.trim() || !isValidIncidentDate(incidentDate) || busy}
            onPress={() => void save()}
          />
        </Card>
      ) : null}

      <Card tone={colors.surfaceMuted} flat>
        <Text variant="small">
          Only export when you are ready to share. The PDF includes your saved messages and
          screenshots, dates, notes, and a disclaimer; review it before sending.
          {Platform.OS === 'web' ? ' PDF export is available in the phone app.' : ''}
        </Text>
      </Card>
      <Button
        label="Export PDF"
        kind="outline"
        disabled={!items.length || busy || Platform.OS === 'web'}
        onPress={() => {
          setBusy(true);
          void exportEvidencePack(items)
            .catch((error: unknown) =>
              showToast(error instanceof Error ? error.message : 'Could not export the PDF.'),
            )
            .finally(() => setBusy(false));
        }}
      />

      {items.length === 0 ? (
        <Text variant="small" color={colors.textMuted}>
          No evidence saved yet. Add a screenshot here or save a scanned message.
        </Text>
      ) : (
        [...groups].map(([title, records]) => (
          <Section key={title} title={title}>
            <Group>
              {records.map((item) => (
                <GroupRow
                  key={item.id}
                  leading={
                    item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={{ width: 42, height: 42, borderRadius: 6 }}
                      />
                    ) : undefined
                  }
                  icon={item.imageUri ? undefined : 'file'}
                  title={item.imageUri ? 'Screenshot' : 'Saved message'}
                  subtitle={item.note || item.messageText?.slice(0, 90) || 'Saved privately'}
                  trailing={
                    <IconButton
                      icon="trash"
                      label="Delete record"
                      tone={colors.surfaceMuted}
                      onPress={() => confirmDelete(item)}
                    />
                  }
                />
              ))}
            </Group>
          </Section>
        ))
      )}
      <View style={{ height: spacing.md }} />
    </Screen>
  );
}
