// Unhooked Wrapped: one shareable card for the last 7 days, from the user's own records.

import { Share, StyleSheet, View } from 'react-native';

import { DotPattern } from '@/components/DotPattern';
import { Button, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyWeekWrap, weekWrap, type WeekWrap } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import { shortDate } from '@/lib/format';
import { useSession } from '@/store/session';

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

function headline(w: WeekWrap): string {
  if (w.kept > 0) return `You kept ${formatPHP(w.kept)} by waiting.`;
  if (w.dodged > 0) return `You dodged ${w.dodged} ${w.dodged === 1 ? 'hook' : 'hooks'}.`;
  if (w.paid > 0) return `You paid ${formatPHP(w.paid)} on your debts.`;
  return 'A quiet week. One small step is enough.';
}

function shareText(w: WeekWrap): string {
  return [
    `My week, unhooked (${shortDate(w.since)} to today)`,
    headline(w),
    `Kept by waiting: ${formatPHP(w.kept)}`,
    `Repayments made: ${formatPHP(w.paid)}`,
    `Hooks dodged: ${w.dodged}`,
    `Scrolling tracked: ${formatMinutes(w.scrollMinutes)}`,
  ].join('\n');
}

export default function WrappedScreen() {
  const { data: w } = useDbQuery(weekWrap, emptyWeekWrap);
  const showToast = useSession((s) => s.showToast);

  const share = async () => {
    try {
      await Share.share({ message: shareText(w) });
    } catch {
      showToast('Sharing is not available here.');
    }
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Your week, wrapped" subtitle={`${shortDate(w.since)} to today`} />

      <View style={styles.card}>
        <DotPattern color="#FFF6EC" opacity={0.08} gap={24} />
        <Text variant="eyebrow" color={colors.pauseMuted}>
          Unhooked · 7 days
        </Text>
        <Text variant="title" color={colors.pauseText}>
          {headline(w)}
        </Text>

        <View style={styles.grid}>
          <Stat value={formatPHP(w.kept)} label={`Kept by waiting · ${w.keptItems} items`} />
          <Stat value={formatPHP(w.paid)} label={`Repaid · ${w.payments} payments`} />
          <Stat value={String(w.dodged)} label="Hooks dodged" />
          <Stat value={formatMinutes(w.scrollMinutes)} label="Scrolling tracked" />
        </View>

        <Text variant="small" color={colors.pauseMuted}>
          {w.peakHour != null
            ? `Most scrolling around ${hourLabel(w.peakHour)}. ${w.breaks} ${w.breaks === 1 ? 'break' : 'breaks'} taken.`
            : `${w.breaks} ${w.breaks === 1 ? 'break' : 'breaks'} taken.`}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-start', gap: 6 }}>
        <Tag certainty="fact" />
        <Text variant="small" color={colors.textMuted}>
          Only numbers from this phone. Nothing about your lenders or messages is shared.
        </Text>
      </View>

      <Button label="Share my week" kind="ink" icon="share" onPress={() => void share()} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="number" color={colors.pauseText}>
        {value}
      </Text>
      <Text variant="caption" color={colors.pauseMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pause,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  stat: { width: '50%', gap: 2, paddingRight: spacing.md },
});
