// Daily check-in: three taps, one question at a time. Optional and never a diagnosis.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Ginto, type GintoMood } from '@/components/mascot/Ginto';
import { Button, goBack, Screen, Tag, Text, TopBar } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { saveTodayCheckIn } from '@/db/checkins';
import { latestCheckIn } from '@/db/repo';
import { bumpData, useDbQuery } from '@/db/useDbQuery';
import { dailyFeeling } from '@/domain/wellness';
import { useSession } from '@/store/session';

type Score = 1 | 2 | 3 | 4 | 5;

const QUESTIONS = [
  { key: 'mood', q: 'How is your mood?', low: 'Low', high: 'Great' },
  { key: 'stress', q: 'How stressed do you feel?', low: 'Calm', high: 'Very stressed' },
  { key: 'fatigue', q: 'How mentally tired are you?', low: 'Fresh', high: 'Drained' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];

const REACTIONS: Record<Key, Record<Score, GintoMood>> = {
  mood: { 1: 'worried', 2: 'sleepy', 3: 'calm', 4: 'happy', 5: 'proud' },
  stress: { 1: 'proud', 2: 'happy', 3: 'calm', 4: 'thinking', 5: 'worried' },
  fatigue: { 1: 'proud', 2: 'happy', 3: 'calm', 4: 'thinking', 5: 'sleepy' },
};

const SCORES: Score[] = [1, 2, 3, 4, 5];

export default function CheckInScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { data: today, loaded } = useDbQuery(latestCheckIn, null);
  const [answers, setAnswers] = useState<Partial<Record<Key, Score>>>({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const question = QUESTIONS[step] ?? QUESTIONS[0];
  const selected = answers[question.key];
  const lastStep = step === QUESTIONS.length - 1;
  const complete = QUESTIONS.every((q) => answers[q.key]);

  // Picking a number moves on by itself; only the last answer needs a save.
  const choose = (n: Score) => {
    setAnswers((a) => ({ ...a, [question.key]: n }));
    if (!lastStep) setTimeout(() => setStep((s) => Math.min(s + 1, QUESTIONS.length - 1)), 220);
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

  if (!loaded) return <Screen tabs={false}>{null}</Screen>;

  if (today) {
    const feeling = dailyFeeling(today);
    return (
      <Screen tabs={false}>
        <TopBar icon="close" />
        <View style={styles.center}>
          <Ginto mood={feeling.fish} size={120} />
          <Text variant="caption">Today</Text>
          <Text variant="title" align="center">
            {feeling.label}
          </Text>
          <View style={{ alignSelf: 'center' }}>
            <Tag certainty="estimate" />
          </View>
        </View>
        <View style={styles.summary}>
          <Rating label="Mood" value={today.mood} />
          <Rating label="Stress" value={today.stress} />
          <Rating label="Tired" value={today.fatigue} />
        </View>
        <Text variant="small" align="center" color={colors.textMuted}>
          You can check in again tomorrow.
        </Text>
        <Button
          label="See past check-ins"
          kind="outline"
          onPress={() => router.replace('/check-in-history')}
        />
      </Screen>
    );
  }

  return (
    <Screen tabs={false}>
      <TopBar
        icon="close"
        right={
          <View style={styles.steps} accessibilityLabel={`Question ${step + 1} of 3`}>
            {QUESTIONS.map((q, i) => (
              <View
                key={q.key}
                style={[styles.step, i <= step && { backgroundColor: colors.text }]}
              />
            ))}
          </View>
        }
      />

      <View style={styles.center}>
        <Ginto
          key={`${question.key}-${selected ?? 0}`}
          mood={selected ? REACTIONS[question.key][selected] : 'curious'}
          size={140}
        />
        <Text variant="title" align="center">
          {question.q}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={styles.scale}>
          {SCORES.map((n) => {
            const active = selected === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${n} of 5`}
                onPress={() => choose(n)}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text
                  variant="heading"
                  color={active ? colors.bg : colors.text}
                  style={{ fontFamily: fonts.semibold }}
                >
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.ends}>
          <Text variant="caption">{question.low}</Text>
          <Text variant="caption">{question.high}</Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        {lastStep ? (
          <Button
            label="Save check-in"
            kind="ink"
            disabled={!complete || saving}
            onPress={() => void save()}
          />
        ) : null}
        {step > 0 ? (
          <Button label="Back" kind="ghost" size="sm" onPress={() => setStep((s) => s - 1)} />
        ) : null}
      </View>

      <Text variant="caption" align="center">
        Optional. It only shapes how gently I talk to you. Never a diagnosis.
      </Text>
    </Screen>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="number">{value}</Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  steps: { flexDirection: 'row', gap: 6 },
  step: { width: 22, height: 6, borderRadius: 3, backgroundColor: colors.track },
  scale: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: { backgroundColor: colors.text, borderColor: colors.text },
  ends: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  summary: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
