// Unhooked Wrapped: the last 7 days from the user's own records, shareable as text.

import { Share, StyleSheet, View } from 'react-native';

import { Button, Group, GroupRow, Screen, ScreenHeader, Section, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyWeekWrap, weekWrap, type WeekWrap } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { formatMinutes } from '@/domain/scroll';
import { shortDate } from '@/lib/format';
import { useSession } from '@/store/session';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function hourLabel(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

function shareText(w: WeekWrap): string {
  return [
    `My week on Unhooked (${shortDate(w.since)} to today)`,
    `Kept by waiting: ${formatPHP(w.kept)}`,
    `Repaid: ${formatPHP(w.paid)}`,
    `Hooks dodged: ${w.dodged}`,
    `Scrolling: ${formatMinutes(w.scrollMinutes)}`,
  ].join('\n');
}

export default function WrappedScreen() {
  const { data: w } = useDbQuery(weekWrap, emptyWeekWrap);
  const showToast = useSession((s) => s.showToast);
  const max = Math.max(1, ...w.days.map((d) => d.n));

  const share = async () => {
    try {
      await Share.share({ message: shareText(w) });
    } catch {
      showToast('Sharing is not available here.');
    }
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="This week" subtitle={`${shortDate(w.since)} to today`} />

      <View style={{ gap: 2 }}>
        <Text variant="caption">Kept by waiting</Text>
        <Text variant="display" style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.5 }}>
          {formatPHP(w.kept)}
        </Text>
        <Text variant="small" color={colors.textMuted}>
          {w.keptItems
            ? `${w.keptItems} ${w.keptItems === 1 ? 'thing' : 'things'} you decided not to buy`
            : 'Save something to cool off and skip it to see this grow'}
        </Text>
      </View>

      <View style={styles.chart}>
        <View style={styles.chartHead}>
          <Text variant="strong">Hooks dodged</Text>
          <Text variant="strong">{w.dodged}</Text>
        </View>
        {w.dodged === 0 ? (
          <Text variant="small" color={colors.textMuted}>
            Each time you close a guarded app or skip a purchase, it lands here.
          </Text>
        ) : null}
        <View style={[styles.bars, w.dodged === 0 && { height: 48 }]}>
          {w.days.map((d, i) => {
            const today = i === w.days.length - 1;
            return (
              <View key={d.date.toISOString()} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(4, (d.n / max) * 100)}%`,
                        backgroundColor: d.n ? colors.text : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text variant="caption" color={today ? colors.text : colors.textFaint}>
                  {DAY[d.date.getDay()]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Section title="The rest of your week">
        <Group>
          <GroupRow
            title="Repaid"
            subtitle={`${w.payments} ${w.payments === 1 ? 'payment' : 'payments'}`}
            value={formatPHP(w.paid)}
          />
          <GroupRow
            title="Scrolling"
            subtitle={
              w.peakHour != null ? `Most around ${hourLabel(w.peakHour)}` : 'Nothing tracked yet'
            }
            value={formatMinutes(w.scrollMinutes)}
          />
          <GroupRow title="Breaks taken" value={String(w.breaks)} />
        </Group>
      </Section>

      <Button label="Share my week" kind="outline" icon="share" onPress={() => void share()} />
      <Text variant="caption" align="center">
        Only these totals are shared. Lenders and messages stay on this phone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', gap: spacing.sm, height: 120 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 6 },
});
