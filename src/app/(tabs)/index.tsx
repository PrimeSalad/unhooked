import { Icon } from '@/components/Icon';
import { Redirect, router, type Href } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ginto, type GintoMood } from '@/components/mascot/Ginto';
import {
  Button,
  Group,
  GroupRow,
  IconButton,
  LargeTitle,
  Screen,
  Section,
  Text,
  type IconName,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { dodgedLast7Days, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { getMonthlyPosition } from '@/domain/monthlyPosition';
import { formatMinutes } from '@/domain/scroll';
import { dueLabel, greeting, isUrgent, timeLeft } from '@/lib/format';
import { useSettings, useSettingsHydrated } from '@/store/settings';

const ACTIONS: { icon: IconName; label: string; detail: string; to: Href }[] = [
  {
    icon: 'bag',
    label: 'Check a purchase',
    detail: 'Make room for what matters.',
    to: '/spend-check',
  },
  {
    icon: 'wallet',
    label: 'Add a debt',
    detail: 'Put the next repayment in view.',
    to: '/debt-new',
  },
  {
    icon: 'leaf',
    label: 'Take back your time',
    detail: 'Set a boundary for scrolling.',
    to: '/scroll',
  },
];

export default function TodayScreen() {
  const hydrated = useSettingsHydrated();
  const { onboarded, name, timerUntil, budget, focus: preference } = useSettings();
  const { width } = useWindowDimensions();
  const wide = width >= 1180;
  const { data: o, error, retry } = useDbQuery(getOverview, emptyOverview);
  const { data: week } = useDbQuery(dodgedLast7Days, []);
  const { data: rules } = useDbQuery(listRules, []);
  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
  const cooling = o.cooling[0];
  const timer = timerUntil ? timeLeft(timerUntil) : null;
  const guards = rules.filter((r) => r.enabled).length;
  const weekTotal = week.reduce((sum, day) => sum + day.n, 0);
  const position = getMonthlyPosition({
    budget,
    repayments: o.dueThisMonth,
    spent: o.spentThisMonth,
  });
  const focus: { mood: GintoMood; title: string; body: string; cta: string; to: Href } = o.nextDue
    ? {
        mood: 'brave',
        title: 'A little clarity for your next repayment.',
        body: `${formatPHP(o.nextDue.outstanding)} to ${o.nextDue.debt.counterparty}, ${dueLabel(o.nextDue.debt.dueDate).toLowerCase()}. Give it a place in your plan.`,
        cta: 'Review repayment',
        to: '/debt',
      }
    : cooling
      ? {
          mood: 'calm',
          title: 'Let the impulse settle. Then decide.',
          body: `${cooling.item} is still cooling off. A little distance can make the choice clearer.`,
          cta: 'Review your purchase',
          to: '/spend',
        }
      : preference === 'debt'
        ? {
            mood: 'brave',
            title: 'Your next chapter starts with a clear picture.',
            body: 'Bring your repayments into one place. Start with one debt and take it from there.',
            cta: 'Add your first debt',
            to: '/debt-new',
          }
        : preference === 'scroll'
          ? {
              mood: 'calm',
              title: 'Less on autopilot. More on your terms.',
              body: 'Set a boundary for your next scroll. Make a little room for the rest of your day.',
              cta: 'Make time for yourself',
              to: '/scroll',
            }
          : {
              mood: 'calm',
              title: 'A little pause. A choice that feels like you.',
              body: 'Before the next purchase, see how it fits your month. You get the space. You make the call.',
              cta: 'Check a purchase',
              to: '/spend-check',
            };
  return (
    <Screen>
      <LargeTitle
        eyebrow={`${greeting('')} ${name ? `· ${name}` : ''}`}
        title="A little more intention."
        right={
          <IconButton
            icon="person"
            label="You and settings"
            onPress={() => router.push('/settings')}
          />
        }
      />
      {error && (
        <View accessibilityRole="alert" style={styles.error}>
          <Text variant="small">Your records could not be loaded.</Text>
          <Button label="Try again" kind="outline" size="sm" onPress={retry} />
        </View>
      )}
      <View style={[styles.split, wide && styles.horizontal]}>
        <View style={[styles.hero, { flex: wide ? 1.55 : undefined }]}>
          <View style={styles.heroTop}>
            <Icon name="leaf" size={18} color={colors.primarySoft} />
            <Text variant="eyebrow" color={colors.pauseMuted} style={{ fontSize: 10 }}>
              A moment for you
            </Text>
          </View>
          <Text
            variant="display"
            color={colors.bg}
            style={{
              fontSize: wide ? 38 : 30,
              lineHeight: wide ? 48 : 40,
              letterSpacing: -1.2,
              maxWidth: 470,
            }}
          >
            {focus.title}
          </Text>
          <Text color={colors.pauseMuted} style={{ maxWidth: 420, fontSize: 14, lineHeight: 23 }}>
            {focus.body}
          </Text>
          <View style={styles.heroBottom}>
            <Button
              label={focus.cta}
              icon="arrow-forward"
              onPress={() => router.push(focus.to)}
              style={{ flex: 1, maxWidth: 300 }}
            />
            <Ginto mood={focus.mood} size={76} />
          </View>
        </View>
        <View style={[styles.month, { flex: wide ? 1 : undefined }]}>
          <Text variant="eyebrow" style={{ fontSize: 10 }}>
            {new Date().toLocaleDateString('en-PH', { month: 'long' })} at a glance
          </Text>
          <View style={{ gap: 4 }}>
            <Text variant="caption">
              {budget ? 'Available after your commitments' : 'Make the numbers yours'}
            </Text>
            <Text
              variant="display"
              style={{ fontSize: budget ? 36 : 25, lineHeight: 44, letterSpacing: -1 }}
            >
              {budget ? formatPHP(position.safeToSpend) : 'Your month, in focus.'}
            </Text>
          </View>
          {budget ? (
            <Text variant="caption">An estimate from your budget and recorded activity.</Text>
          ) : (
            <Text variant="small">
              Add your income, bills and savings to see how the next purchase fits.
            </Text>
          )}
          <View style={styles.monthRow}>
            <Text variant="small">Repayments due</Text>
            <Text variant="strong">{formatPHP(o.dueThisMonth)}</Text>
          </View>
          <View style={styles.monthRow}>
            <Text variant="small">Purchases recorded</Text>
            <Text variant="strong">{formatPHP(o.spentThisMonth)}</Text>
          </View>
          <Button
            label={budget ? 'Review your spending' : 'Set up your budget'}
            kind="outline"
            size="sm"
            icon="arrow-forward"
            onPress={() => router.push(budget ? '/spend' : '/settings')}
          />
        </View>
      </View>
      <View style={[styles.split, wide && styles.horizontal]}>
        <View style={{ flex: wide ? 1.55 : undefined, gap: 24 }}>
          <Section title="What’s on your mind?">
            <View style={styles.actionList}>
              {ACTIONS.map((action, index) => (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={() => router.push(action.to)}
                  style={({ pressed }) => [
                    styles.action,
                    index > 0 && styles.divider,
                    pressed && { backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <View style={styles.actionIcon}>
                    <Icon name={action.icon} size={20} color={colors.text} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="strong">{action.label}</Text>
                    <Text variant="caption">{action.detail}</Text>
                  </View>
                  <Icon name="arrow-forward" size={19} color={colors.textSoft} />
                </Pressable>
              ))}
            </View>
          </Section>
          {(o.nextDue || cooling || timer || guards > 0) && (
            <Section title="Keep in view">
              <Group>
                {o.nextDue && (
                  <GroupRow
                    icon="wallet"
                    title={o.nextDue.debt.counterparty}
                    subtitle={dueLabel(o.nextDue.debt.dueDate)}
                    value={formatPHP(o.nextDue.outstanding)}
                    valueTone={isUrgent(o.nextDue.debt.dueDate) ? colors.spend : undefined}
                    onPress={() => router.push('/debt')}
                  />
                )}
                {cooling && (
                  <GroupRow
                    icon="hourglass"
                    title={cooling.item}
                    subtitle={
                      cooling.coolingUntil
                        ? (timeLeft(cooling.coolingUntil) ?? 'Ready to decide')
                        : 'Cooling off'
                    }
                    value={formatPHP(cooling.price)}
                    onPress={() => router.push('/spend')}
                  />
                )}
                {(timer || guards > 0) && (
                  <GroupRow
                    icon="lock"
                    title={
                      timer
                        ? 'Your focus timer'
                        : `${guards} saved guard ${guards === 1 ? 'rule' : 'rules'}`
                    }
                    subtitle={timer ?? 'Review rules and device permissions'}
                    onPress={() => router.push('/scroll')}
                  />
                )}
              </Group>
            </Section>
          )}
        </View>
        <View style={{ flex: wide ? 1 : undefined, gap: 24 }}>
          <Section
            title="Small steps add up"
            action="Your patterns"
            onAction={() => router.push('/insights')}
          >
            <View style={styles.momentum}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text variant="display" style={{ fontSize: 42, lineHeight: 52 }}>
                  {weekTotal}
                </Text>
                <Text variant="small">
                  intentional {weekTotal === 1 ? 'choice' : 'choices'} this week
                </Text>
              </View>
              <Text variant="small">
                {weekTotal
                  ? 'Every pause is a chance to choose what comes next.'
                  : 'No streak to protect. Start with one pause, whenever you need it.'}
              </Text>
              {weekTotal > 0 && (
                <View
                  style={styles.week}
                  accessibilityLabel={week
                    .map(
                      (d) => `${d.date.toLocaleDateString('en-PH', { weekday: 'long' })}: ${d.n}`,
                    )
                    .join(', ')}
                >
                  {week.map((d) => (
                    <View key={d.date.toISOString()} style={styles.day}>
                      <View
                        style={{
                          width: '70%',
                          maxWidth: 26,
                          height: 4 + (d.n / Math.max(1, ...week.map((x) => x.n))) * 32,
                          borderRadius: 3,
                          backgroundColor: d.n ? colors.lagoon : colors.track,
                        }}
                      />
                      <Text variant="caption" style={{ fontSize: 10 }}>
                        {d.date.toLocaleDateString('en-PH', { weekday: 'narrow' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.monthRow}>
                <Text variant="caption">Scroll time recorded today</Text>
                <Text variant="strong">{formatMinutes(o.scroll.todayMinutes)}</Text>
              </View>
            </View>
          </Section>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/check-in')}
            style={({ pressed }) => [styles.checkin, pressed && { opacity: 0.7 }]}
          >
            <Icon name="heart" size={22} color={colors.spend} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="strong">
                {o.checkIn ? 'You made space for yourself.' : 'How are you, really?'}
              </Text>
              <Text variant="caption">
                {o.checkIn
                  ? 'Your check-in is saved. Tap to update.'
                  : 'A quick check-in. No right answer.'}
              </Text>
            </View>
            <Icon name="forward" size={18} color={colors.textSoft} />
          </Pressable>
        </View>
      </View>
      <View style={styles.footer}>
        <Icon name="lock" size={13} color={colors.textMuted} />
        <Text variant="caption">Your pace. Your choices. Your data stays here.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { gap: 24 },
  horizontal: { flexDirection: 'row', alignItems: 'stretch' },
  hero: {
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    padding: 28,
    gap: 20,
    justifyContent: 'space-between',
  },
  heroTop: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  month: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    gap: 14,
    backgroundColor: colors.surface,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 13,
  },
  actionList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  action: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    minHeight: 80,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  momentum: { gap: 14 },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    backgroundColor: colors.spendSoft,
    borderRadius: radius.md,
  },
  week: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 62 },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.lg,
  },
  error: {
    gap: 12,
    padding: 16,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
