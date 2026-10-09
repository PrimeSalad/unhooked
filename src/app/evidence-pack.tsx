import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  Group,
  GroupRow,
  IconButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  Section,
  Tag,
  Text,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { addEvidence, deleteEvidence, listEvidence } from '@/db/evidence';
import { addNumberReports, listNumberReports } from '@/db/numberReports';
import { useDbQuery } from '@/db/useDbQuery';
import { isValidIncidentDate } from '@/domain/evidence';
import { assessMessage } from '@/domain/messageRisk';
import { extractEvidenceContacts, summarizeNumbers } from '@/domain/numberLog';
import type { Evidence } from '@/domain/types';
import { exportEvidencePack } from '@/lib/evidenceExport';
import { readImageText, type OcrProgress } from '@/lib/ocr';
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
  const { data: reports } = useDbQuery(listNumberReports, []);
  const [adding, setAdding] = useState(add === '1');
  const [picked, setPicked] = useState<{ uri: string; mimeType: string | null } | null>(null);
  const [lender, setLender] = useState('');
  const [agentName, setAgentName] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [incidentDate, setIncidentDate] = useState(todayLocal);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setPicked({ uri: asset.uri, mimeType: asset.mimeType ?? null });
      setOcrText('');
      setAgentName('');
      setSelectedNumbers([]);
      setOcrProgress({ label: 'Opening the screenshot', value: 0 });
      const text = await readImageText(asset.uri, setOcrProgress);
      setOcrProgress(null);
      if (text) {
        setOcrText(text);
        setAgentName(extractEvidenceContacts(text).agentName ?? '');
        showToast('Text found. Review the suggestions before saving.');
      } else {
        showToast('No text found. You can still save the screenshot.');
      }
    } catch {
      setOcrProgress(null);
      showToast('Could not open your images. Please try again.');
    }
  };

  const save = async () => {
    if (!picked || !lender.trim() || !isValidIncidentDate(incidentDate) || busy || ocrProgress)
      return;
    setBusy(true);
    try {
      await addEvidence(db, {
        lender,
        agentName,
        incidentDate,
        note,
        imageUri: picked.uri,
        imageMimeType: picked.mimeType,
        messageText: ocrText.trim() || null,
        riskLevel: ocrText.trim() ? assessMessage(ocrText).level : null,
      });
      let logSaved = true;
      if (selectedNumbers.length) {
        try {
          await addNumberReports(
            db,
            selectedNumbers.map((number) => ({ number, agentName, seenOn: incidentDate })),
          );
        } catch {
          logSaved = false;
        }
      }
      setAdding(false);
      setPicked(null);
      setLender('');
      setAgentName('');
      setOcrText('');
      setSelectedNumbers([]);
      setNote('');
      setIncidentDate(todayLocal());
      showToast(
        logSaved
          ? selectedNumbers.length
            ? 'Screenshot and selected numbers saved privately.'
            : 'Screenshot saved privately on this phone.'
          : 'Screenshot saved, but numbers could not be logged. Add them in Reported numbers.',
      );
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
  const candidates = useMemo(() => extractEvidenceContacts(ocrText).numbers, [ocrText]);
  const recentNumbers = useMemo(() => summarizeNumbers(reports).slice(0, 3), [reports]);
  const toggleNumber = (number: string) =>
    setSelectedNumbers((selected) =>
      selected.includes(number)
        ? selected.filter((item) => item !== number)
        : [...selected, number],
    );

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
            disabled={!!ocrProgress}
            onPress={() => void chooseScreenshot()}
          />
          {picked ? (
            <Image
              source={{ uri: picked.uri }}
              style={{ width: '100%', height: 150, resizeMode: 'contain' }}
            />
          ) : null}
          {ocrProgress ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption">{ocrProgress.label}</Text>
              {ocrProgress.value !== null ? <ProgressBar value={ocrProgress.value} /> : null}
            </View>
          ) : null}
          {picked ? (
            <View style={{ gap: spacing.sm }}>
              <Tag certainty="estimate" label="Unverified OCR suggestions" />
              <Field
                label="Text read from screenshot (editable)"
                placeholder="Paste or correct the text if OCR missed it"
                value={ocrText}
                onChangeText={(value) => {
                  setOcrText(value);
                  setSelectedNumbers([]);
                }}
                multiline
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
              <Field
                label="Possible agent name (edit if needed)"
                value={agentName}
                onChangeText={setAgentName}
              />
              <Text variant="small">
                Select only numbers you personally want to report. A screenshot may also contain a
                payment recipient or your own number.
              </Text>
              {candidates.length ? (
                candidates.map((candidate) => {
                  const selected = selectedNumbers.includes(candidate.number);
                  return (
                    <Pressable
                      key={candidate.number}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${candidate.number}, ${candidate.context}`}
                      onPress={() => toggleNumber(candidate.number)}
                      style={{
                        padding: spacing.md,
                        borderRadius: 12,
                        backgroundColor: selected ? colors.track : colors.surfaceMuted,
                        borderWidth: selected ? 1.5 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text variant="strong">
                        {selected ? '✓ ' : ''}
                        {candidate.number}
                      </Text>
                      <Text variant="caption">{candidate.context}</Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text variant="caption">No Philippine mobile number found in the text.</Text>
              )}
            </View>
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
            <Text variant="caption" color={colors.danger}>
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
            disabled={
              !picked ||
              !lender.trim() ||
              !isValidIncidentDate(incidentDate) ||
              busy ||
              !!ocrProgress
            }
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

      <Section
        title="Reported numbers"
        action="See all"
        onAction={() => router.push('/number-log')}
      >
        <Group>
          {recentNumbers.length ? (
            recentNumbers.map((number) => (
              <GroupRow
                key={number.number}
                icon="phone"
                title={number.number}
                subtitle={`${number.agentName || 'Agent not recorded'} · Last seen ${number.lastSeenOn}`}
                value={String(number.reports)}
                onPress={() => router.push('/number-log')}
              />
            ))
          ) : (
            <GroupRow
              icon="phone"
              title="No numbers reported yet"
              subtitle="Review OCR suggestions or add a number yourself."
              onPress={() => router.push('/number-log')}
            />
          )}
        </Group>
      </Section>

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
                  subtitle={
                    item.agentName
                      ? `Possible agent: ${item.agentName}${item.note ? ` · ${item.note}` : ''}`
                      : item.note || item.messageText?.slice(0, 90) || 'Saved privately'
                  }
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
