import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { GroupRow, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { WellnessCheckIn } from '@/domain/types';
import { dailyFeeling, recentMoodDays } from '@/domain/wellness';

const W = 280;
const H = 120;
const TOP = 10;
const BOTTOM = 110;
const scoreY = (score: number) => TOP + ((5 - score) / 4) * (BOTTOM - TOP);
const dayX = (index: number) => ((index + 0.5) / 7) * W;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

/** One past day: the overall feeling, its date, and the three ratings in one line. */
export function CheckInRow({ checkIn }: { checkIn: WellnessCheckIn }) {
  const feeling = dailyFeeling(checkIn);
  return (
    <GroupRow
      title={feeling.label}
      subtitle={`Mood ${checkIn.mood} · Stress ${checkIn.stress} · Tired ${checkIn.fatigue}`}
      value={dateLabel(checkIn.createdAt)}
    />
  );
}

export function MoodChart({ checkIns }: { checkIns: WellnessCheckIn[] }) {
  const days = recentMoodDays(checkIns);
  const description = days
    .map(
      ({ date, mood }) =>
        `${date.toLocaleDateString('en-PH', { weekday: 'short' })}: ${mood === null ? 'no check-in' : `mood ${mood}`}`,
    )
    .join(', ');

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="strong">Mood, last 7 days</Text>
        <Text variant="caption">1 low · 5 great</Text>
      </View>
      <View accessible accessibilityLabel={`Mood chart. ${description}`}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[1, 3, 5].map((score) => (
            <Line
              key={score}
              x1={0}
              x2={W}
              y1={scoreY(score)}
              y2={scoreY(score)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {days.slice(0, -1).map((day, i) => {
            const next = days[i + 1];
            return day.mood !== null && next && next.mood !== null ? (
              <Line
                key={`l${i}`}
                x1={dayX(i)}
                x2={dayX(i + 1)}
                y1={scoreY(day.mood)}
                y2={scoreY(next.mood)}
                stroke={colors.text}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ) : null;
          })}
          {days.map((day, i) =>
            day.mood !== null ? (
              <Circle
                key={`p${i}`}
                cx={dayX(i)}
                cy={scoreY(day.mood)}
                r={5}
                fill={i === days.length - 1 ? colors.primary : colors.text}
                stroke={colors.surface}
                strokeWidth={2}
              />
            ) : null,
          )}
        </Svg>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
          {days.map(({ date }, i) => (
            <Text
              key={date.toISOString()}
              variant="caption"
              align="center"
              color={i === days.length - 1 ? colors.text : colors.textFaint}
              style={{ flex: 1 }}
            >
              {WEEKDAY[date.getDay()]}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
