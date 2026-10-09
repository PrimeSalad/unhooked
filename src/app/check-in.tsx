import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { Button, goBack, Row, ScreenHeader, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { bumpData } from '@/db/useDbQuery';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSession } from '@/store/session';

type Score = 1 | 2 | 3 | 4 | 5;
const QUESTIONS = [
  { key: 'stress', q: 'How much is on your mind?', low: 'Calm', high: 'Very stressed' },
  { key: 'mood', q: 'How is your mood?', low: 'Low', high: 'Great' },
  { key: 'fatigue', q: 'How is your energy?', low: 'Fresh', high: 'Drained' },
] as const;
type Key = (typeof QUESTIONS)[number]['key'];

export default function CheckInScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const action = useAsyncAction();
  const [answers, setAnswers] = useState<Partial<Record<Key, Score>>>({});
  const complete = QUESTIONS.every((q) => answers[q.key]);
  const save = () => action.run(async () => {
    if (!complete) return;
    const { stress, mood, fatigue } = answers as Record<Key, Score>;
    await db.runAsync('INSERT INTO checkins (id, stress, mood, fatigue, created_at) VALUES (?, ?, ?, ?, ?)', Crypto.randomUUID(), stress, mood, fatigue, new Date().toISOString());
    await logEvent(db, 'checkin_completed', { stress, mood, fatigue });
    bumpData();
    goBack();
    showToast(stress >= 4 || fatigue >= 4 ? 'Check-in saved. Your guidance will be gentler today.' : 'Check-in saved. Take today at your own pace.');
  });
  return (
    <FlowScreen>
      <ScreenHeader back title="How are you, really?" subtitle="A small check-in, with no right answers." />
      <Text>Your answers help Ginto choose a gentler pause when you need one. They stay on this device and are never a diagnosis.</Text>
      {QUESTIONS.map((q, index) => (
        <FormSection key={q.key} title={`${String(index + 1).padStart(2, '0')}  ${q.q}`}>
          <View accessibilityRole="radiogroup" accessibilityLabel={q.q} style={styles.options}>
            {([1, 2, 3, 4, 5] as Score[]).map((n) => {
              const active = answers[q.key] === n;
              return <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`${q.q} ${n} of 5${n === 1 ? `, ${q.low}` : n === 5 ? `, ${q.high}` : ''}`} onPress={() => setAnswers((a) => ({ ...a, [q.key]: n }))} style={({ pressed }) => [styles.option, active && styles.selected, pressed && { opacity: 0.75 }]}><Text variant="heading" color={active ? colors.bg : colors.textSoft}>{n}</Text></Pressable>;
            })}
          </View>
          <Row style={{ justifyContent: 'space-between' }}><Text variant="caption">{q.low}</Text><Text variant="caption">{q.high}</Text></Row>
        </FormSection>
      ))}
      <ActionError message={action.error} />
      <Button label="Save my check-in" disabled={!complete} loading={action.pending} onPress={() => void save()} />
      <Button label="Skip for now" kind="ghost" onPress={goBack} disabled={action.pending} />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.text, borderColor: colors.text },
});
