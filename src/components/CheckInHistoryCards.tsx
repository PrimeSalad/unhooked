import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Ginto } from '@/components/mascot/Ginto';
import { Card, Tag, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import type { WellnessCheckIn } from '@/domain/types';
import { dailyFeeling, recentMoodDays } from '@/domain/wellness';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 148;
const CHART_TOP = 14;
const CHART_BOTTOM = 132;
const scoreY = (score: number) => CHART_TOP + ((5 - score) / 4) * (CHART_BOTTOM - CHART_TOP);
const dayX = (index: number) => ((index + 0.5) / 7) * CHART_WIDTH;

function dateLabel(iso: string, year = false) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(year ? { year: 'numeric' as const } : {}),
  });
}

export function CheckInRecord({ checkIn }: { checkIn: WellnessCheckIn }) {
  const feeling = dailyFeeling(checkIn);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption">{dateLabel(checkIn.createdAt, true)}</Text>
          <Text variant="eyebrow">Overall feeling</Text>
          <Tag certainty="estimate" />
          <Text variant="heading">{feeling.label}</Text>
        </View>
        <Ginto mood={feeling.fish} size={76} animated={false} />
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Rating label="Mood" score={checkIn.mood} highlight />
        <Rating label="Stress" score={checkIn.stress} />
        <Rating label="Fatigue" score={checkIn.fatigue} />
      </View>
    </Card>
  );
}

function Rating({
  label,
  score,
  highlight = false,
}: {
  label: string;
  score: number;
  highlight?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        padding: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: highlight ? colors.track : colors.surfaceMuted,
        alignItems: 'center',
      }}
      accessible
      accessibilityLabel={`${label}, ${score} out of 5`}
    >
      <Text variant="caption">{label}</Text>
      <Text variant="strong" color={colors.text}>
        {score}/5
      </Text>
    </View>
  );
}

export function MoodChart({
  checkIns,
  latest,
}: {
  checkIns: WellnessCheckIn[];
  latest: WellnessCheckIn;
}) {
  const days = recentMoodDays(checkIns);
  const latestFeeling = dailyFeeling(latest);
  const chartDescription = days
    .map(
      ({ date, mood }) =>
        `${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}: ${mood === null ? 'no check-in' : `mood ${mood} out of 5`}`,
    )
    .join(', ');

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Tag certainty="fact" />
          <Text variant="heading">Mood trend</Text>
          <Text variant="caption">7 days through {dateLabel(latest.createdAt, true)}</Text>
        </View>
        <Ginto mood={latestFeeling.fish} size={78} />
      </View>
      <View accessible accessibilityLabel={`Self-rated mood chart. ${chartDescription}`}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 24, height: CHART_HEIGHT }}>
            {[5, 3, 1].map((score) => (
              <Text
                key={score}
                variant="caption"
                style={{ position: 'absolute', top: scoreY(score) - 8, right: 5 }}
              >
                {score}
              </Text>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Svg
              width="100%"
              height={CHART_HEIGHT}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
            >
              {[1, 2, 3, 4, 5].map((score) => (
                <Line
                  key={score}
                  x1={0}
                  x2={CHART_WIDTH}
                  y1={scoreY(score)}
                  y2={scoreY(score)}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              ))}
              {days.slice(0, -1).map((day, index) => {
                const next = days[index + 1];
                return day.mood !== null && next && next.mood !== null ? (
                  <Line
                    key={`line-${index}`}
                    x1={dayX(index)}
                    x2={dayX(index + 1)}
                    y1={scoreY(day.mood)}
                    y2={scoreY(next.mood)}
                    stroke={colors.primary}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                ) : null;
              })}
              {days.map((day, index) =>
                day.mood !== null ? (
                  <Circle
                    key={`point-${index}`}
                    cx={dayX(index)}
                    cy={scoreY(day.mood)}
                    r={6}
                    fill={colors.primary}
                    stroke={colors.surface}
                    strokeWidth={2}
                  />
                ) : null,
              )}
            </Svg>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginLeft: 24 }}>
          {days.map(({ date }) => (
            <Text
              key={date.toISOString()}
              variant="caption"
              align="center"
              style={{ flex: 1, fontSize: 10 }}
            >
              {date.getMonth() + 1}/{date.getDate()}
            </Text>
          ))}
        </View>
      </View>
      <Text variant="caption">
        Dots show your mood rating: 1 low, 5 great. Gaps mean no check-in.
      </Text>
    </Card>
  );
}
