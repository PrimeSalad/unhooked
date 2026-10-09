import { Icon } from '@/components/Icon';
import { Redirect, router, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
import {
  Group,
  GroupRow,
  IconButton,
  LargeTitle,
  Rise,
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
import { formatMinutes } from '@/domain/scroll';
import { dueLabel, greeting, isUrgent, timeLeft } from '@/lib/format';
import { useSettings, useSettingsHydrated } from '@/store/settings';

const ACTIONS: { icon: IconName; label: string; bg: string; fg: string; to: Href }[] = [
  {
    icon: 'bag',
    label: 'Check a\npurchase',
    bg: colors.spendSoft,
    fg: colors.spend,
    to: '/spend-check',
  },
  {
    icon: 'wallet',
    label: 'Add a\ndebt',
    bg: colors.debtSoft,
    fg: colors.debt,
    to: '/debt-new',
  },
  {
    icon: 'lock',
    label: 'Guard\napps',
    bg: colors.scrollSoft,
    fg: colors.scroll,
    to: '/block/apps',
  },
  {
    icon: 'shield',
    label: 'Scan a\nmessage',
    bg: '#F3ECE4',
    fg: colors.text,
    to: '/message-check',
  },
];

export default function TodayScreen() {
  const hydrated = useSettingsHydrated();
  const onboarded = useSettings((s) => s.onboarded);
  const permissionsReviewed = useSettings((s) => s.permissionsReviewed);
  const name = useSettings((s) => s.name);
  const timerUntil = useSettings((s) => s.timerUntil);
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const { data: week } = useDbQuery(dodgedLast7Days, []);
  const { data: rules } = useDbQuery(listRules, []);

  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/welcome" />;
  if (Platform.OS === 'android' && !permissionsReviewed) return <Redirect href="/permissions" />;

  const max = Math.max(1, ...week.map((d) => d.n));
  const cooling = o.cooling[0];
  const timer = timerUntil ? timeLeft(timerUntil) : null;
  const guards = rules.filter((r) => r.enabled).length;

  const upcoming = [
    o.nextDue && (
      <GroupRow
        key="due"
        icon="wallet"
        iconBg={colors.debtSoft}
        iconFg={colors.debt}
        title={o.nextDue.debt.counterparty}
        subtitle={dueLabel(o.nextDue.debt.dueDate)}
        value={formatPHP(o.nextDue.outstanding)}
        valueTone={isUrgent(o.nextDue.debt.dueDate) ? colors.spend : undefined}
        onPress={() => router.push('/debt')}
      />
    ),
    cooling && (
      <GroupRow
        key="cool"
        icon="hourglass"
        iconBg={colors.spendSoft}
        iconFg={colors.spend}
        title={cooling.item}
        subtitle={
          cooling.coolingUntil
            ? (timeLeft(cooling.coolingUntil) ?? 'Ready to decide')
            : 'Cooling off'
        }
        value={formatPHP(cooling.price)}
        onPress={() => router.push('/spend')}
      />
    ),
    (timer || guards > 0) && (
      <GroupRow
        key="guard"
        icon="lock"
        iconBg={colors.scrollSoft}
        iconFg={colors.scroll}
        title={timer ? 'Unhook timer running' : `${guards} ${guards === 1 ? 'guard' : 'guards'} on`}
        subtitle={timer ?? 'Apps and sites you chose to pause'}
        onPress={() => router.push('/scroll')}
      />
    ),
    o.scroll.todayMinutes > 0 && (
      <GroupRow
        key="scroll"
        icon="device"
        iconBg={colors.scrollSoft}
        iconFg={colors.scroll}
        title="Scrolling today"
        subtitle={`Longest session ${formatMinutes(o.scroll.longestToday)}`}
        value={formatMinutes(o.scroll.todayMinutes)}
        onPress={() => router.push('/scroll')}
      />
    ),
  ].filter(Boolean);

  return (
    <Screen>
      <LargeTitle
        eyebrow={greeting('')}
        title={name ? `Hi, ${name}` : 'Hi there'}
        right={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <IconButton
              icon="person"
              label="You and settings"
              onPress={() => router.push('/settings')}
            />
          </View>
        }
      />

      <Rise>
        <View style={styles.hero}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="eyebrow" color="#D9BFA8" style={{ fontSize: 11 }}>
              Today
            </Text>
            <Text variant="display" color={colors.bg} style={{ fontSize: 56, lineHeight: 60 }}>
              {o.dodgedToday}
            </Text>
            <Text variant="strong" color={colors.bg}>
              {o.dodgedToday === 1 ? 'hook dodged' : 'hooks dodged'}
            </Text>
            <View style={styles.week}>
              {week.map((d, i) => (
                <View key={d.date.toISOString()} style={{ alignItems: 'center', gap: 4 }}>
                  <View
                    style={{
                      width: 8,
                      height: 6 + (d.n / max) * 22,
                      borderRadius: 4,
                      backgroundColor:
                        i === week.length - 1
                          ? colors.primary
                          : d.n
                            ? colors.accent
                            : 'rgba(255,246,236,0.18)',
                    }}
                  />
                  <Text variant="caption" color="#B39580" style={{ fontSize: 10 }}>
                    {'SMTWTFS'[d.date.getDay()]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <Ginto mood={o.dodgedToday > 0 ? 'proud' : 'happy'} size={118} />
          <View style={styles.heroStats}>
            <HeroStat value={String(o.breaksToday)} label="Breaks" />
            <HeroStat value={String(o.cooling.length)} label="Cooling off" />
            <HeroStat value={formatMinutes(o.scroll.todayMinutes)} label="Scrolled" />
          </View>
        </View>
      </Rise>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/chat')}
        style={({ pressed }) => [styles.ask, pressed && { opacity: 0.9 }]}
      >
        <Ginto mood="thinking" size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="strong">Ask Ginto</Text>
          <Text variant="caption">“Can I afford ₱1,500?” · “What is due this month?”</Text>
        </View>
        <Icon name="arrow-forward" size={18} color={colors.text} />
      </Pressable>

      <View style={styles.actions}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label.replace('\n', ' ')}
            onPress={() => router.push(a.to)}
            style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
              <Icon name={a.icon} size={24} color={a.fg} />
            </View>
            <Text
              variant="caption"
              color={colors.text}
              align="center"
              style={{ fontSize: 12, lineHeight: 15 }}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Section title="Coming up">
        <Group>
          {upcoming.length ? (
            upcoming
          ) : (
            <GroupRow
              icon="check-circle"
              iconBg="#F3ECE4"
              iconFg={colors.success}
              title="All clear"
              subtitle="No due dates, cooling items or guards yet."
            />
          )}
        </Group>
      </Section>

      <Section title="You">
        <Group>
          <GroupRow
            icon="heart"
            title={o.checkIn ? 'Checked in today' : 'How are you feeling?'}
            subtitle={o.checkIn ? 'Tap to update' : 'Ten seconds. Keeps my tone gentle.'}
            onPress={() => router.push('/check-in')}
          />
          <GroupRow
            icon="chart"
            title="Your week"
            subtitle="Patterns from your own activity"
            onPress={() => router.push('/insights')}
          />
          <GroupRow
            icon="share"
            title="Unhooked Wrapped"
            subtitle="Your 7 days on one card you can share"
            onPress={() => router.push('/wrapped')}
          />
        </Group>
      </Section>
    </Screen>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="strong" color={colors.bg} style={{ fontSize: 17 }}>
        {value}
      </Text>
      <Text variant="caption" color="#B39580">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.text,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  week: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    marginTop: spacing.md,
    height: 44,
  },
  heroStats: {
    flexBasis: '100%',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,246,236,0.12)',
    paddingTop: spacing.md,
  },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { width: '23%', alignItems: 'center', gap: 6 },
  actionIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
