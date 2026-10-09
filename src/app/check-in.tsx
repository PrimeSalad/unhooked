import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ginto, type GintoMood } from '@/components/mascot/Ginto';
import { Button, Card, goBack, ProgressBar, Row, Screen, Text, TopBar } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { saveTodayCheckIn } from '@/db/checkins';
import { latestCheckIn } from '@/db/repo';
import { bumpData, useDbQuery } from '@/db/useDbQuery';
import { useSession } from '@/store/session';

type Score = 1 | 2 | 3 | 4 | 5;

const QUESTIONS = [
  { key: 'stress', q: 'How stressed are you feeling?', low: 'Calm', high: 'Very stressed' },
  { key: 'mood', q: 'How would you describe your mood?', low: 'Low', high: 'Great' },
  { key: 'fatigue', q: 'How mentally tired do you feel?', low: 'Fresh', high: 'Drained' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];

const REACTIONS: Record<Key, Record<Score, GintoMood>> = {
  stress: { 1: 'proud', 2: 'happy', 3: 'calm', 4: 'thinking', 5: 'worried' },
  mood: { 1: 'worried', 2: 'sleepy', 3: 'calm', 4: 'happy', 5: 'proud' },
  fatigue: { 1: 'proud', 2: 'happy', 3: 'calm', 4: 'thinking', 5: 'sleepy' },
};

const SCORES: Score[] = [1, 2, 3, 4, 5];

export default function CheckInScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { data: todayCheckIn, loaded } = useDbQuery(latestCheckIn, null);
  const [answers, setAnswers] = useState<Partial<Record<Key, Score>>>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const question = QUESTIONS[step] ?? QUESTIONS[0];
  const selected = answers[question.key];
  const lastStep = step === QUESTIONS.length - 1;
  const complete = QUESTIONS.every((q) => answers[q.key]);
  const fishMood = selected ? REACTIONS[question.key][selected] : 'curious';

  const next = () => {
    setStep((current) => {
      const currentQuestion = QUESTIONS[current];
      return currentQuestion && answers[currentQuestion.key]
        ? Math.min(current + 1, QUESTIONS.length - 1)
        : current;
    });
  };

  const save = async () => {
    if (!complete || saving) return;
    const { stress, mood, fatigue } = answers as Record<Key, Score>;
    setSaving(true);
    try {
      const saved = await saveTodayCheckIn(db, { stress, mood, fatigue });
      if (!saved) {
        bumpData();
        showToast('You already checked in today. Come back tomorrow.');
        return;
      }
      goBack();
      showToast(
        stress >= 4 || fatigue >= 4
          ? 'Thanks for telling me. I will keep things gentle today.'
          : 'Thanks. Have a steady day.',
      );
    } catch {
      showToast('Could not save your check-in. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <Screen tabs={false}>
        <TopBar icon="close" />
        <Text>Checking today’s check-in…</Text>
      </Screen>
    );
  }

  if (todayCheckIn) {
    return (
      <Screen tabs={false}>
        <TopBar icon="close" />
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Ginto mood="proud" size={178} />
          <Text variant="title" align="center">
            Checked in today
          </Text>
          <Text align="center" color={colors.textMuted}>
            Your answers are saved. You can check in again tomorrow.
          </Text>
        </View>
        <Button label="View check-in history" onPress={() => router.replace('/check-in-history')} />
        <Button label="Back to Today" onPress={goBack} />
      </Screen>
    );
  }

  return (
    <Screen tabs={false}>
      <TopBar icon="close" />
      <View style={{ gap: spacing.sm }}>
        <Text variant="eyebrow">
          Question {step + 1} of {QUESTIONS.length}
        </Text>
        <ProgressBar value={(step + 1) / QUESTIONS.length} height={6} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Ginto key={`${question.key}-${selected ?? 0}`} mood={fishMood} size={178} />
        <Text variant="title" align="center">
          How are you today?
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          Ginto changes with each answer. This check-in is optional, and it is never a diagnosis.
        </Text>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text variant="heading">{question.q}</Text>
        <Text variant="small" color={colors.textMuted}>
          Pick the number that feels closest right now.
        </Text>
        <Row gap={spacing.sm}>
          {SCORES.map((n) => {
            const active = selected === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${question.q} ${n} of 5`}
                onPress={() => setAnswers((a) => ({ ...a, [question.key]: n }))}
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
          <Text variant="caption">1 · {question.low}</Text>
          <Text variant="caption">5 · {question.high}</Text>
        </Row>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Button
          label={lastStep ? 'Save check-in' : 'Next question'}
          disabled={(lastStep ? !complete : !selected) || saving}
          onPress={lastStep ? () => void save() : next}
        />
        {step > 0 ? (
          <Button
            label="Previous question"
            kind="outline"
            size="sm"
            onPress={() => setStep((s) => s - 1)}
          />
        ) : null}
        <Button label="Skip for now" kind="ghost" size="sm" onPress={goBack} />
      </View>
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
