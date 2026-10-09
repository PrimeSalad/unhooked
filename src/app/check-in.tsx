import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Card, Row, Screen, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { useSession } from '@/store/session';

type Score = 1 | 2 | 3 | 4 | 5;

const QUESTIONS = [
  { key: 'stress', q: 'How stressed are you feeling?', low: 'Calm', high: 'Very stressed' },
  { key: 'mood', q: 'How would you describe your mood?', low: 'Low', high: 'Great' },
  { key: 'fatigue', q: 'How mentally tired do you feel?', low: 'Fresh', high: 'Drained' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];

export default function CheckInScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [answers, setAnswers] = useState<Partial<Record<Key, Score>>>({});
  const complete = QUESTIONS.every((q) => answers[q.key]);

  const save = async () => {
    const { stress, mood, fatigue } = answers as Record<Key, Score>;
    await db.runAsync(
      'INSERT INTO checkins (id, stress, mood, fatigue, created_at) VALUES (?, ?, ?, ?, ?)',
      Crypto.randomUUID(),
      stress,
      mood,
      fatigue,
      new Date().toISOString(),
    );
    await logEvent(db, 'checkin_completed', { stress, mood, fatigue });
    router.back();
    showToast(
      stress >= 4 || fatigue >= 4
        ? 'Thanks for telling me. I will keep things gentle today.'
        : 'Thanks. Have a steady day.',
    );
  };

  return (
    <Screen tabs={false}>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Ginto mood="calm" size={140} />
        <Text variant="title" align="center">
          How are you today?
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          Optional. It only softens how I talk to you. It is never a diagnosis.
        </Text>
      </View>

      {QUESTIONS.map((q) => (
        <Card key={q.key} style={{ gap: spacing.md }}>
          <Text variant="strong">{q.q}</Text>
          <Row gap={spacing.sm}>
            {([1, 2, 3, 4, 5] as Score[]).map((n) => {
              const active = answers[q.key] === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${q.q} ${n} of 5`}
                  onPress={() => setAnswers((a) => ({ ...a, [q.key]: n }))}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text variant="strong" color={active ? colors.primaryText : colors.textSoft}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption">{q.low}</Text>
            <Text variant="caption">{q.high}</Text>
          </Row>
        </Card>
      ))}

      <Button label="Save check-in" disabled={!complete} onPress={() => void save()} />
      <Button label="Skip for now" kind="ghost" size="sm" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary },
});
