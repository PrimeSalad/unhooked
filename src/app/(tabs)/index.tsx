import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, IconButton, ListRow, Rise, Row, Screen, Stat, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import { dueLabel, greeting, timeLeft } from '@/lib/format';
import { useSettings, useSettingsHydrated } from '@/store/settings';

function heroCopy(dodged: number, breaks: number) {
  if (dodged === 0 && breaks === 0) {
    return {
      title: 'No hooks yet today',
      body: 'When a purchase, a loan or a long scroll starts pulling, tap the pause button below.',
    };
  }
  return {
    title: `${dodged} ${dodged === 1 ? 'hook' : 'hooks'} dodged today`,
    body:
      breaks > 0
        ? `Plus ${breaks} ${breaks === 1 ? 'break' : 'breaks'} from the feed. Small choices add up.`
        : 'Each pause is a choice you made for future you.',
  };
}

export default function TodayScreen() {
  const hydrated = useSettingsHydrated();
  const onboarded = useSettings((s) => s.onboarded);
  const name = useSettings((s) => s.name);
  const { data: o } = useDbQuery(getOverview, emptyOverview);

  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/welcome" />;

  const hero = heroCopy(o.dodgedToday, o.breaksToday);
  const cooling = o.cooling[0];
  const coolingLeft = cooling?.coolingUntil ? timeLeft(cooling.coolingUntil) : null;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="caption">
            {greeting('')} ·{' '}
            {new Date().toLocaleDateString('en-PH', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {name ? `Hi, ${name}` : 'Hi there'}
          </Text>
        </View>
        <Row gap={spacing.sm}>
          <IconButton
            icon="help-buoy-outline"
            label="Help and safety"
            onPress={() => router.push('/help')}
          />
          <IconButton
            icon="settings-outline"
            label="Privacy and settings"
            onPress={() => router.push('/settings')}
          />
        </Row>
      </Row>

      <Rise>
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.md,
          }}
        >
          <View style={{ paddingRight: 118, gap: 6, minHeight: 104, justifyContent: 'center' }}>
            <Text variant="heading" style={{ fontSize: 22, lineHeight: 27 }}>
              {hero.title}
            </Text>
            <Text variant="small">{hero.body}</Text>
          </View>
          <Ginto
            mood={o.dodgedToday > 0 ? 'happy' : 'wave'}
            size={122}
            style={{ position: 'absolute', right: 8, top: 12 }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/chat')}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.pill,
                paddingVertical: 12,
                paddingHorizontal: spacing.lg,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
            <Text variant="small" color={colors.textMuted} style={{ flex: 1 }}>
              Ask Ginto: “Can I afford ₱1,500?”
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </Rise>

      <Rise delay={60}>
        <Row gap={10}>
          <Stat value={o.dodgedToday} label="Pauses" />
          <Stat value={o.breaksToday} label="Breaks" />
          <Stat value={o.cooling.length} label="Cooling off" />
        </Row>
      </Rise>

      <Rise delay={120} style={{ gap: 10 }}>
        <ListRow
          icon="wallet-outline"
          iconBg={colors.debtSoft}
          iconFg={colors.debt}
          title={
            o.nextDue
              ? `${formatPHP(o.nextDue.outstanding)} to ${o.nextDue.debt.counterparty}`
              : o.owedTotal > 0
                ? `${formatPHP(o.owedTotal)} left to pay`
                : 'Track what you owe'
          }
          subtitle={
            o.nextDue
              ? dueLabel(o.nextDue.debt.dueDate)
              : o.owedTotal > 0
                ? 'No due dates set'
                : 'Add a loan, a BNPL plan or money you lent'
          }
          onPress={() => router.push('/debt')}
        />
        <ListRow
          icon="bag-handle-outline"
          iconBg={colors.spendSoft}
          iconFg={colors.spend}
          title={cooling ? `${cooling.item} is cooling off` : 'Check a purchase before you buy'}
          subtitle={
            cooling
              ? (coolingLeft ?? 'Ready to decide')
              : 'Affordability, BNPL true cost, 24-hour pause'
          }
          onPress={() => router.push('/spend')}
        />
        <ListRow
          icon="phone-portrait-outline"
          iconBg={colors.scrollSoft}
          iconFg={colors.scroll}
          title={
            o.scroll.todayMinutes > 0
              ? `${formatMinutes(o.scroll.todayMinutes)} scrolling today`
              : 'Scroll on purpose'
          }
          subtitle={
            o.scroll.todayMinutes > 0
              ? `Longest session ${formatMinutes(o.scroll.longestToday)}`
              : 'Start a session with a limit; I will check in'
          }
          onPress={() => router.push('/scroll')}
        />
        <ListRow
          icon="bar-chart-outline"
          iconBg="#F4ECE4"
          iconFg={colors.text}
          title="Your week"
          subtitle="Patterns from your own activity"
          onPress={() => router.push('/insights')}
        />
      </Rise>

      <Rise delay={180}>
        <Button
          label={o.checkIn ? 'Checked in today. Update?' : 'How are you feeling today?'}
          kind="ghost"
          icon="heart-outline"
          size="sm"
          onPress={() => router.push('/check-in')}
        />
      </Rise>
    </Screen>
  );
}
