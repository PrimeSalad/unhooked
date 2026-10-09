// First launch: four levels. Level 1 is the orange hello; levels 2–4 put Ginto and plain type
// straight on cream, no panels. Everything is optional. Nothing leaves the phone.

import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, Field, IconButton, Rise, Row, Segmented, Tag, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import type { Certainty } from '@/domain/types';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { useFrameWidth } from '@/hooks/useFrame';
import { keyboardBehavior } from '@/hooks/useKeyboard';
import { useSettings } from '@/store/settings';

const LEVELS = 4;
const RING_SECONDS = 10;

export default function WelcomeScreen() {
  const [level, setLevel] = useState(1);
  const next = () => setLevel((l) => Math.min(LEVELS, l + 1));
  const back = () => setLevel((l) => Math.max(1, l - 1));

  if (level === 1) return <Hello onNext={next} />;
  return (
    <Frame level={level} onBack={back} onSkip={() => setLevel(LEVELS)}>
      {level === 2 ? <Pause /> : level === 3 ? <LocalAi /> : null}
      {level === 4 ? <YourMonth /> : <Button label="Next" kind="ink" onPress={next} />}
    </Frame>
  );
}

// ---------- Level 1 · orange hello ----------

function Hello({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const display = Math.min(60, width * 0.16);
  return (
    <View
      style={[
        styles.orange,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <DotPattern />
      <Hook x={width - 96} y={insets.top + 120} shown lineColor="#FFE1B8" />
      <Rise style={{ gap: 8 }}>
        <Text variant="eyebrow" color="#3B1E08">
          Hi, I am Ginto
        </Text>
        <Text variant="display" style={{ fontSize: display, lineHeight: display + 4 }}>
          unhooked
        </Text>
        <Text variant="heading" color="#3B1E08" style={{ fontSize: 17 }}>
          Pause. Understand. Decide.
        </Text>
      </Rise>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ginto mood="wave" size={Math.min(250, width * 0.64)} />
      </View>
      <Rise delay={140} style={{ gap: spacing.lg }}>
        <Text style={{ fontSize: 16, lineHeight: 25 }}>
          Loan apps, pay-later carts and endless feeds are built to hook you. When one pulls, I
          pause with you for ten seconds and show your real numbers. You decide.
        </Text>
        <Button label="Continue" kind="ink" onPress={onNext} />
        <Dots level={1} dark />
      </Rise>
    </View>
  );
}

// ---------- Levels 2–4 share this frame ----------

function Frame({
  level,
  onBack,
  onSkip,
  children,
}: {
  level: number;
  onBack: () => void;
  onSkip: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={keyboardBehavior}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={[
          styles.cream,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
          <IconButton icon="back" label="Back" onPress={onBack} tone="transparent" />
          <Dots level={level} />
          {level < LEVELS ? (
            <Button label="Skip" kind="ghost" size="sm" onPress={onSkip} />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </Row>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingVertical: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Rise key={level} from="right" style={{ flex: 1, gap: spacing.xl }}>
            {children}
          </Rise>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- Level 2 · the pause ----------

function Pause() {
  const width = useFrameWidth();
  const ring = Math.min(280, width * 0.7);
  // Refill every RING_SECONDS so the screen keeps breathing while the user reads.
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), RING_SECONDS * 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
        <CountdownRing
          key={cycle}
          seconds={RING_SECONDS}
          size={ring}
          stroke={8}
          track={colors.track}
        >
          <Ginto mood="calm" size={ring * 0.66} />
        </CountdownRing>
        <Text variant="caption">Breathe in. Choices unlock when the ring closes.</Text>
      </View>
      <Copy
        title="Ten real seconds."
        body="When something pulls, Ginto pauses with you. The buttons stay locked until the ring closes. The wait is the point, not the warning."
      />
    </>
  );
}

// ---------- Level 3 · the AI on your phone ----------

function LocalAi() {
  const width = useFrameWidth();
  return (
    <>
      <View style={{ alignItems: 'center' }}>
        <Ginto mood="thinking" size={Math.min(200, width * 0.5)} />
      </View>
      <View style={{ gap: spacing.lg }}>
        <Line certainty="estimate" strong>
          ₱4,500 today would leave your Oct 15 repayment about ₱1,500 short.
        </Line>
        <Line certainty="fact">Your records show ₱3,000 due by month-end.</Line>
        <Line certainty="suggestion">Saving it for 24 hours keeps your options open.</Line>
        <Text variant="caption">Phrased on this phone · Gemma 4 E2B</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Copy
        title="The AI stays on your phone."
        body="Ginto runs a small language model on this chip. It phrases your own numbers, labels every line, and never uploads a thing. Airplane mode changes nothing."
      />
    </>
  );
}

function Line({
  certainty,
  strong,
  children,
}: {
  certainty: Certainty;
  strong?: boolean;
  children: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Tag certainty={certainty} />
      <Text variant={strong ? 'heading' : 'body'}>{children}</Text>
    </View>
  );
}

// ---------- Level 4 · your month ----------

function YourMonth() {
  const { setName, setBudget, setOnboarded, setPermissionsReviewed } = useSettings();
  const [name, setNameText] = useState('');
  const [income, setIncome] = useState('');
  const [bills, setBills] = useState('');
  const [savings, setSavings] = useState('');
  const [pay, setPay] = useState<'monthly' | 'twice'>('twice');

  const incomeC = parsePesoInput(income);
  const free =
    incomeC !== null
      ? incomeC - (parsePesoInput(bills) ?? 0) - (parsePesoInput(savings) ?? 0)
      : null;

  const finish = () => {
    setName(name);
    if (incomeC) {
      setBudget({
        monthlyIncome: incomeC,
        monthlyFixedBills: parsePesoInput(bills) ?? 0,
        savingsGoalMonthly: parsePesoInput(savings) ?? 0,
        payday: pay === 'twice' ? '15_30' : null,
      });
    }
    setOnboarded(true);
    if (Platform.OS === 'android') {
      router.replace('/permissions');
      return;
    }
    setPermissionsReviewed(true);
    router.replace('/');
  };

  return (
    <>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Copy
            title="Your month, roughly."
            body="Three numbers so every pause starts from your real month. Optional, and only you see them."
          />
        </View>
        <Ginto mood="dive" size={92} />
      </Row>
      <View style={{ gap: spacing.lg }}>
        <Field
          label="What should I call you?"
          placeholder="First name"
          value={name}
          onChangeText={setNameText}
          autoCapitalize="words"
          maxLength={24}
        />
        <Field
          label="Comes in each month"
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={income}
          onChangeText={setIncome}
        />
        <Field
          label="Fixed bills"
          hint="Rent, utilities, load, fare. Loans go in Debt later."
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={bills}
          onChangeText={setBills}
        />
        <Field
          label="Set aside"
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={savings}
          onChangeText={setSavings}
        />
        <View style={{ gap: 6 }}>
          <Text variant="caption" color={colors.textSoft}>
            Payday
          </Text>
          <Segmented
            value={pay}
            onChange={setPay}
            options={[
              { value: 'twice', label: '15th & 30th' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
        </View>
        {free !== null ? (
          <Line certainty="estimate">
            {free > 0
              ? `About ${formatPHP(free)} free to spend this month, before any loans.`
              : 'Bills and savings use everything this month. We will plan from here.'}
          </Line>
        ) : null}
      </View>
      <View style={{ flex: 1 }} />
      <Button label={incomeC ? 'Start' : 'Start without a budget'} onPress={finish} />
    </>
  );
}

// ---------- shared ----------

function Copy({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="title">{title}</Text>
      <Text variant="small" color={colors.textMuted}>
        {body}
      </Text>
    </View>
  );
}

function Dots({ level, dark }: { level: number; dark?: boolean }) {
  const on = dark ? '#3B1E08' : colors.text;
  const off = dark ? 'rgba(59,30,8,0.25)' : colors.track;
  return (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      {Array.from({ length: LEVELS }, (_, i) => (
        <View
          key={i}
          style={{
            width: i + 1 === level ? 22 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i + 1 === level ? on : off,
          }}
        />
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  orange: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
  cream: { flex: 1, paddingHorizontal: spacing.xl },
});
