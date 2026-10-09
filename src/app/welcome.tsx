import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Ginto } from '@/components/mascot/Ginto';
import { Button, Field, Text, TopBar } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { formatPHP, parsePesoInput } from '@/domain/money';
import type { BudgetProfile } from '@/domain/types';
import {
  type FocusPreference,
  type OnboardingDraft,
  useSettings,
  useSettingsHydrated,
} from '@/store/settings';

const focuses: { value: FocusPreference; icon: IconName; title: string; body: string }[] = [
  {
    value: 'debt',
    icon: 'wallet',
    title: 'Get a handle on debt',
    body: 'Keep repayments in view and plan your next move.',
  },
  {
    value: 'spend',
    icon: 'bag',
    title: 'Spend with more intention',
    body: 'Check a purchase against your month before buying.',
  },
  {
    value: 'scroll',
    icon: 'timer',
    title: 'Make room beyond the scroll',
    body: 'Set a session reminder and take a proper break.',
  },
];

type FormErrors = Partial<Record<'income' | 'bills' | 'savings' | 'scrollLimit', string>>;

function readBudget(draft: OnboardingDraft): { budget: BudgetProfile | null; errors: FormErrors } {
  const errors: FormErrors = {};
  if (![draft.income, draft.bills, draft.savings].some((value) => value.trim()))
    return { budget: null, errors };
  const income = parsePesoInput(draft.income);
  const bills = draft.bills.trim() ? parsePesoInput(draft.bills) : 0;
  const savings = draft.savings.trim() ? parsePesoInput(draft.savings) : 0;
  if (income === null || !Number.isSafeInteger(income) || income <= 0)
    errors.income = 'Enter an income above ₱0, or leave all three amounts blank.';
  if (bills === null || !Number.isSafeInteger(bills))
    errors.bills = 'Enter a positive amount or 0, with up to two decimal places.';
  if (savings === null || !Number.isSafeInteger(savings))
    errors.savings = 'Enter a positive amount or 0, with up to two decimal places.';
  return {
    budget: Object.keys(errors).length
      ? null
      : {
          monthlyIncome: income!,
          monthlyFixedBills: bills!,
          savingsGoalMonthly: savings!,
          payday: null,
        },
    errors,
  };
}

export default function WelcomeScreen() {
  const hydrated = useSettingsHydrated();
  if (!hydrated)
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.text} accessibilityLabel="Loading your setup" />
      </View>
    );
  return <WelcomeFlow />;
}

function WelcomeFlow() {
  const { revisit } = useLocalSearchParams<{ revisit?: string }>();
  const [alreadyOnboarded] = useState(() => useSettings.getState().onboarded);
  const draft = useSettings((state) => state.onboardingDraft);
  const currentBudget = useSettings((state) => state.budget);
  const currentScrollLimit = useSettings((state) => state.scrollLimitMinutes);
  const updateDraft = useSettings((state) => state.updateOnboardingDraft);
  const completeOnboarding = useSettings((state) => state.completeOnboarding);
  const [errors, setErrors] = useState<FormErrors>({});
  const [storageError, setStorageError] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const step = saving ? 3 : draft.step;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  if (alreadyOnboarded && revisit !== '1') return <Redirect href="/" />;

  const change = (patch: Partial<OnboardingDraft>) => {
    void updateDraft(patch).then(
      () => setStorageError(''),
      () =>
        setStorageError(
          'Your changes are still here, but could not be saved on this device. Try again before closing the app.',
        ),
    );
  };
  const changeField = (field: keyof OnboardingDraft, value: string) => {
    change({ [field]: value });
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const continueSetup = () => {
    const nextErrors =
      draft.focus === 'scroll'
        ? /^\d+$/.test(draft.scrollLimit) &&
          Number(draft.scrollLimit) >= 1 &&
          Number(draft.scrollLimit) <= 240
          ? {}
          : { scrollLimit: 'Choose a whole number from 1 to 240 minutes.' }
        : readBudget(draft).errors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) change({ step: 3, skipBudget: false });
  };
  const selectedFocus = focuses.find((focus) => focus.value === draft.focus);
  const budget =
    draft.skipBudget || draft.focus === 'scroll' ? currentBudget : readBudget(draft).budget;
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setStorageError('');
    try {
      await completeOnboarding({
        name: draft.name,
        focus: draft.focus,
        ...(draft.skipBudget || draft.focus === 'scroll' ? {} : { budget }),
        ...(draft.focus === 'scroll' && !draft.skipBudget
          ? { scrollLimitMinutes: Number(draft.scrollLimit) }
          : {}),
      });
      router.replace('/');
    } catch {
      setSaving(false);
      setStorageError(
        'Setup could not be saved. Your answers are still here. Check that device storage is available, then try again.',
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (wide ? 36 : 20), paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.frame, { maxWidth: step === 0 ? 1080 : 600 }]}>
          {step === 0 ? (
            <>
              <View style={styles.brandRow}>
                <Text variant="heading" style={styles.wordmark}>
                  unhooked<Text color={colors.primary}>.</Text>
                </Text>
                <Text variant="caption">A little more in your control</Text>
              </View>
              <View style={[styles.welcomeLayout, wide && styles.welcomeWide]}>
                <View style={styles.welcomeCopy}>
                  <Text variant="eyebrow" color={colors.link}>
                    MONEY. TIME. PEACE OF MIND.
                  </Text>
                  <Text variant="display" style={[styles.heroTitle, wide && styles.heroTitleWide]}>
                    A little space.{'\n'}A better choice.
                  </Text>
                  <Text color={colors.textSoft} style={styles.heroDescription}>
                    Between the urge and the next move, there’s room for you. Take a pause, see the
                    bigger picture, and choose what works for your life.
                  </Text>
                  <View style={styles.welcomeActions}>
                    <Button
                      label={alreadyOnboarded ? 'Revisit my setup' : 'Find my starting point'}
                      icon="arrow-forward"
                      kind="ink"
                      onPress={() => change({ step: 1 })}
                    />
                    <Text variant="caption">About a minute. No account, no bank connection.</Text>
                  </View>
                </View>
                <View style={[styles.welcomeAside, wide && styles.welcomeAsideWide]}>
                  <View style={styles.asideHeading}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="heading" color={colors.bg}>
                        Small pauses.{'\n'}Real life.
                      </Text>
                      <Text variant="small" color={colors.pauseMuted}>
                        Ginto is here to help you make room.
                      </Text>
                    </View>
                    <Ginto mood="calm" size={86} />
                  </View>
                  {focuses.map((focus, index) => (
                    <View key={focus.value} style={styles.promiseRow}>
                      <Text variant="caption" color={colors.primary}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                      <Text variant="strong" color={colors.bg} style={{ flex: 1 }}>
                        {focus.title}
                      </Text>
                      <Icon name={focus.icon} color={colors.pauseMuted} size={20} />
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.welcomeFooter}>
                <Icon name="lock" size={16} color={colors.textMuted} />
                <Text variant="caption" style={{ flex: 1 }}>
                  Your core records and guidance stay on this device.
                </Text>
                {alreadyOnboarded ? (
                  <Button
                    label="Back home"
                    kind="ghost"
                    size="sm"
                    onPress={() => router.replace('/')}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <>
              <View style={styles.topRow}>
                <TopBar
                  onPress={() => {
                    if (!saving) change({ step: Math.max(0, step - 1) as OnboardingDraft['step'] });
                  }}
                />
                <Text variant="strong" style={styles.smallWordmark}>
                  unhooked.
                </Text>
                <Text variant="caption" accessibilityLabel={`Setup step ${step} of 3`}>
                  {step} / 3
                </Text>
              </View>
              <View
                style={styles.progress}
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 3, now: step }}
                accessibilityLabel="Setup progress"
              >
                <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
              </View>
              {step === 1 ? (
                <View style={styles.stepBody}>
                  <StepHeader
                    eyebrow="Your starting point"
                    title="What would you like more room for?"
                    body="Pick what matters most today. We’ll put that first on your home screen. Every tool is still yours to use."
                  />
                  <View accessibilityRole="radiogroup" accessibilityLabel="Choose your focus">
                    {focuses.map((focus) => (
                      <FocusRow
                        key={focus.value}
                        focus={focus}
                        selected={draft.focus === focus.value}
                        onPress={() => change({ focus: focus.value, skipBudget: false })}
                      />
                    ))}
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label="Continue"
                      kind="ink"
                      icon="arrow-forward"
                      disabled={!draft.focus}
                      onPress={() => change({ step: 2 })}
                    />
                    <Button
                      label="I’ll explore first"
                      kind="ghost"
                      onPress={() => change({ focus: null, step: 2, skipBudget: false })}
                    />
                  </View>
                </View>
              ) : null}
              {step === 2 ? (
                <View style={styles.stepBody}>
                  <StepHeader
                    eyebrow="A few useful details"
                    title={
                      draft.focus === 'scroll'
                        ? 'A gentler stopping point.'
                        : 'Your month, in perspective.'
                    }
                    body={
                      draft.focus === 'scroll'
                        ? 'Choose when you’d like a reminder during a scroll session. You can adjust it any time.'
                        : 'A rough budget helps put purchases and repayments in context. Add what you know, or leave it for later.'
                    }
                  />
                  <Field
                    label="What should we call you? (optional)"
                    placeholder="Your first name"
                    value={draft.name}
                    onChangeText={(value) => changeField('name', value)}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    maxLength={40}
                  />
                  {draft.focus === 'scroll' ? (
                    <View style={styles.formSection}>
                      <Field
                        label="Session reminder (minutes)"
                        hint="From 1 to 240 minutes. This is a check-in, not a restriction."
                        placeholder="20"
                        keyboardType="number-pad"
                        value={draft.scrollLimit}
                        onChangeText={(value) => changeField('scrollLimit', value)}
                        error={errors.scrollLimit}
                      />
                      <View style={styles.presets}>
                        {[10, 20, 30, 60].map((minutes) => (
                          <Pressable
                            key={minutes}
                            accessibilityRole="radio"
                            accessibilityLabel={`${minutes} minutes`}
                            accessibilityState={{ selected: draft.scrollLimit === String(minutes) }}
                            onPress={() => changeField('scrollLimit', String(minutes))}
                            style={({ pressed }) => [
                              styles.preset,
                              draft.scrollLimit === String(minutes) && styles.presetSelected,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text
                              variant="strong"
                              color={
                                draft.scrollLimit === String(minutes) ? colors.bg : colors.text
                              }
                            >
                              {minutes} min
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text variant="small" color={colors.textMuted}>
                        Start and record sessions yourself in Scroll. App blocking, where supported,
                        has its own optional setup.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.formSection}>
                      <Text variant="strong">Your usual month · optional</Text>
                      <Field
                        label="Monthly take-home income"
                        placeholder="₱ 0"
                        keyboardType="decimal-pad"
                        value={draft.income}
                        onChangeText={(value) => changeField('income', value)}
                        error={errors.income}
                      />
                      <Field
                        label="Fixed bills and essentials"
                        hint="Rent, utilities, transport and subscriptions. Leave debt repayments out; add those in Debt."
                        placeholder="₱ 0"
                        keyboardType="decimal-pad"
                        value={draft.bills}
                        onChangeText={(value) => changeField('bills', value)}
                        error={errors.bills}
                      />
                      <Field
                        label="Monthly savings goal"
                        hint="Leave blank or enter 0 if you aren’t setting money aside yet."
                        placeholder="₱ 0"
                        keyboardType="decimal-pad"
                        value={draft.savings}
                        onChangeText={(value) => changeField('savings', value)}
                        error={errors.savings}
                      />
                    </View>
                  )}
                  <PrivacyNote />
                  <View style={styles.actions}>
                    <Button
                      label="Review my setup"
                      kind="ink"
                      icon="arrow-forward"
                      onPress={continueSetup}
                    />
                    <Button
                      label="Skip these details"
                      kind="ghost"
                      onPress={() => {
                        setErrors({});
                        change({ step: 3, skipBudget: true });
                      }}
                    />
                  </View>
                </View>
              ) : null}
              {step === 3 ? (
                <View style={styles.stepBody}>
                  <View style={styles.completionSignature}>
                    <Ginto mood="happy" size={100} />
                    <Text variant="eyebrow" color={colors.link}>
                      A good place to begin
                    </Text>
                  </View>
                  <StepHeader
                    title={
                      draft.name.trim()
                        ? `Make a little room, ${draft.name.trim()}.`
                        : 'Make a little room for yourself.'
                    }
                    body="No perfect streaks required. Start with one decision, and come back whenever you need a pause."
                  />
                  <View style={styles.summary}>
                    <SummaryRow
                      icon={selectedFocus?.icon ?? 'home'}
                      title={selectedFocus?.title ?? 'Explore at your own pace'}
                      body={
                        selectedFocus
                          ? 'Your home screen will lead with this focus.'
                          : 'Debt, Spend and Scroll are ready when you are.'
                      }
                    />
                    {draft.focus === 'scroll' ? (
                      <SummaryRow
                        icon="timer"
                        title={`${draft.skipBudget ? currentScrollLimit : draft.scrollLimit} minute session reminder`}
                        body="A gentle check-in during sessions you start in Scroll."
                      />
                    ) : (
                      <SummaryRow
                        icon="calculator"
                        title={
                          budget
                            ? `${formatPHP(budget.monthlyIncome)} monthly income`
                            : 'Add your budget when you’re ready'
                        }
                        body={
                          budget
                            ? `${formatPHP(budget.monthlyFixedBills)} for essentials · ${formatPHP(budget.savingsGoalMonthly)} for savings.`
                            : 'You can still use every tool. Add amounts later in Settings.'
                        }
                      />
                    )}
                    <SummaryRow
                      icon="lock"
                      title="Private by default"
                      body="No account to create. Your setup is saved on this device."
                    />
                  </View>
                  <View style={styles.actions}>
                    <Button
                      label={saving ? 'Saving your setup…' : 'Let’s begin'}
                      kind="ink"
                      icon={saving ? undefined : 'arrow-forward'}
                      disabled={saving}
                      onPress={() => void finish()}
                    />
                    <Button
                      label="Edit my details"
                      kind="ghost"
                      disabled={saving}
                      onPress={() => change({ step: 2 })}
                    />
                  </View>
                </View>
              ) : null}
            </>
          )}
          {storageError ? (
            <Text accessibilityRole="alert" color={colors.danger} style={styles.error}>
              {storageError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepHeader({ eyebrow, title, body }: { eyebrow?: string; title: string; body: string }) {
  return (
    <View style={styles.stepHeader}>
      {eyebrow ? (
        <Text variant="eyebrow" color={colors.link}>
          {eyebrow}
        </Text>
      ) : null}
      <Text accessibilityRole="header" variant="title" style={styles.stepTitle}>
        {title}
      </Text>
      <Text color={colors.textSoft}>{body}</Text>
    </View>
  );
}
function FocusRow({
  focus,
  selected,
  onPress,
}: {
  focus: (typeof focuses)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${focus.title}. ${focus.body}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.focusRow,
        selected && styles.focusSelected,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={focus.icon} size={24} color={colors.text} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="strong">{focus.title}</Text>
        <Text variant="small">{focus.body}</Text>
      </View>
      <Icon
        name={selected ? 'check-circle' : 'circle'}
        color={selected ? colors.text : colors.textMuted}
        size={22}
      />
    </Pressable>
  );
}
function PrivacyNote() {
  return (
    <View style={styles.privacyNote}>
      <Icon name="lock" color={colors.textMuted} size={18} />
      <Text variant="small" style={{ flex: 1 }}>
        These details stay on your device. No bank login or permissions needed. Change them any time
        in Settings.
      </Text>
    </View>
  );
}
function SummaryRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.summaryRow}>
      <Icon name={icon} color={colors.text} size={22} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="strong">{title}</Text>
        <Text variant="small">{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24 },
  frame: { width: '100%', flexGrow: 1 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordmark: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -1.1 },
  welcomeLayout: { flexGrow: 1, justifyContent: 'center', gap: 32, paddingVertical: 40 },
  welcomeWide: { flexDirection: 'row', alignItems: 'center', gap: 64, paddingVertical: 64 },
  welcomeCopy: { flex: 1, gap: 20 },
  heroTitle: { fontSize: 38, lineHeight: 44, letterSpacing: -1.8 },
  heroTitleWide: { fontSize: 52, lineHeight: 60, letterSpacing: -2.2 },
  heroDescription: { fontSize: 15, lineHeight: 25, maxWidth: 470 },
  welcomeActions: { marginTop: 8, gap: 12, maxWidth: 410 },
  welcomeAside: { backgroundColor: colors.text, padding: 24, borderRadius: radius.lg, gap: 20 },
  welcomeAsideWide: { width: 390, padding: 32, gap: 28 },
  asideHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(247,245,239,0.2)',
  },
  welcomeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  smallWordmark: { fontSize: 18, letterSpacing: -0.5 },
  progress: { height: 3, backgroundColor: colors.border, marginTop: 20, marginBottom: 36 },
  progressFill: { height: 3, backgroundColor: colors.primary },
  stepBody: { gap: 28 },
  stepHeader: { gap: 12 },
  stepTitle: { fontSize: 30, lineHeight: 38, letterSpacing: -1 },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 24,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    minHeight: 104,
  },
  focusSelected: { backgroundColor: colors.surfaceMuted, borderLeftColor: colors.text },
  pressed: { opacity: 0.7 },
  actions: { gap: 4, marginTop: 4 },
  formSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 24, gap: 20 },
  privacyNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  presetSelected: { backgroundColor: colors.text, borderColor: colors.text },
  completionSignature: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  summary: { borderTopWidth: 3, borderTopColor: colors.primary },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  error: { paddingVertical: spacing.lg },
});
