import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DotPattern } from '@/components/DotPattern';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { Button, Field, Rise, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { parsePesoInput } from '@/domain/money';
import { useSettings } from '@/store/settings';

export default function WelcomeScreen() {
  const [step, setStep] = useState<'hello' | 'setup'>('hello');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (step === 'hello') {
    return (
      <View
        style={[
          styles.hello,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <DotPattern />
        <Hook x={width - 92} y={insets.top + 150} shown lineColor="#FFE1B8" />
        <Rise style={{ gap: 10 }}>
          <Text variant="eyebrow" color="#FFE9D2">
            Hi, I am Ginto
          </Text>
          <Text variant="display" style={{ fontSize: 54, lineHeight: 58 }}>
            unhooked
          </Text>
          <Text variant="heading" color="#3B1E08" style={{ fontSize: 17 }}>
            Pause. Understand. Decide.
          </Text>
        </Rise>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ginto mood="wave" size={Math.min(250, width * 0.64)} />
        </View>
        <Rise delay={150} style={{ gap: spacing.lg }}>
          <Text>
            Debt, shopping and endless feeds are designed to hook you. When one pulls, I swim in for
            a short pause and show you your real numbers. You always make the call.
          </Text>
          <Button label="Let's swim" kind="ink" onPress={() => setStep('setup')} />
          <Text variant="caption" color="#3B1E08" align="center">
            No account. Everything stays on your phone.
          </Text>
        </Rise>
      </View>
    );
  }
  return <Setup onBack={() => setStep('hello')} />;
}

function Setup({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { setName, setBudget, setOnboarded } = useSettings();
  const [name, setNameText] = useState('');
  const [income, setIncome] = useState('');
  const [bills, setBills] = useState('');
  const [savings, setSavings] = useState('');

  const incomeC = parsePesoInput(income);
  const finish = (withBudget: boolean) => {
    setName(name);
    if (withBudget && incomeC) {
      setBudget({
        monthlyIncome: incomeC,
        monthlyFixedBills: parsePesoInput(bills) ?? 0,
        savingsGoalMonthly: parsePesoInput(savings) ?? 0,
        payday: null,
      });
    }
    setOnboarded(true);
    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.xl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <TopBar onPress={onBack} />
        <View style={{ alignItems: 'center' }}>
          <Ginto mood="thinking" size={130} />
        </View>
        <Rise style={{ gap: 6 }}>
          <Text variant="title">Make it yours</Text>
          <Text variant="small" color={colors.textMuted}>
            All optional. Your budget lets me check purchases and loans against your real month. It
            never leaves this phone.
          </Text>
        </Rise>
        <Field
          label="What should I call you?"
          placeholder="Your first name"
          value={name}
          onChangeText={setNameText}
          autoCapitalize="words"
        />
        <Field
          label="Monthly income or allowance"
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={income}
          onChangeText={setIncome}
        />
        <Field
          label="Fixed bills each month"
          hint="Rent, utilities, load, fare. A rough number is fine."
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={bills}
          onChangeText={setBills}
        />
        <Field
          label="Savings goal each month"
          placeholder="₱ 0"
          keyboardType="decimal-pad"
          value={savings}
          onChangeText={setSavings}
        />
        <Button label={incomeC ? 'Save and start' : 'Start'} onPress={() => finish(true)} />
        <Button label="Skip for now" kind="ghost" size="sm" onPress={() => finish(false)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hello: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    overflow: 'hidden',
  },
});
