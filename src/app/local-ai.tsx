import { Group, GroupRow, ProgressBar, ScreenHeader, Section, Tag, Text } from '@/components/ui';
import { ActionError, FlowScreen } from '@/components/FlowLayout';
import { buildDailyInference } from '@/ai/dailySnapshot';
import { colors, radius, spacing } from '@/constants/theme';
import { emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { useSettings } from '@/store/settings';
import { StyleSheet, View } from 'react-native';

const BAND = {
  steady: 'No strong pressure pattern',
  watch: 'Worth a closer look',
  high: 'Several signals are stacking up',
} as const;

export default function LocalAiScreen() {
  const { data: overview, error, retry, loaded } = useDbQuery(getOverview, emptyOverview);
  const budget = useSettings((state) => state.budget);
  const scrollLimit = useSettings((state) => state.scrollLimitMinutes);
  const inference = buildDailyInference(overview, budget, scrollLimit);

  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="A little more perspective."
        subtitle="How your own records shape the guidance you see."
      />
      <ActionError
        message={
          error ? 'Your records could not be loaded. Try again for a current reading.' : null
        }
        onRetry={retry}
      />

      {!error && loaded && (
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Tag label="On-device estimate" dark />
            <Text variant="caption" color={colors.pauseMuted}>
              {inference.modelVersion}
            </Text>
          </View>
          <Text variant="display" color={colors.bg} style={styles.score}>
            {inference.score}
          </Text>
          <Text variant="heading" color={colors.bg}>
            {BAND[inference.band]}
          </Text>
          <ProgressBar
            value={inference.score / 100}
            color={colors.primary}
            track="rgba(255,246,236,0.14)"
            height={10}
          />
          <Text variant="small" color={colors.pauseMuted}>
            This is a pressure estimate for choosing the right pause—not a credit score, diagnosis
            or prediction about you.
          </Text>
        </View>
      )}
      {!loaded && <Text>Reading your local records…</Text>}

      <Section title="Why this read">
        <Group>
          {inference.factors.length ? (
            inference.factors.map((factor) => (
              <GroupRow
                key={factor.key}
                icon="chart"
                title={factor.label}
                subtitle={`Signal strength ${Math.round(factor.value * 100)}% · calculated locally`}
              />
            ))
          ) : (
            <GroupRow
              icon="check-circle"
              title="No strong signal yet"
              subtitle="Add a budget, track a session or use an optional check-in for a more personal read."
            />
          )}
        </Group>
      </Section>

      <Section title="What runs on your phone">
        <Group>
          <GroupRow
            icon="chart"
            title="Just-in-time decision model"
            subtitle="Combines repayment load, affordability, scroll limits and optional wellbeing signals."
          />
          <GroupRow
            icon="shield"
            title="English + Taglish message classifier"
            subtitle="A statistical text model and explainable rules check coercion, harassment and suspicious payment requests."
          />
          <GroupRow
            icon="chat"
            title="Grounded Ask Ginto"
            subtitle="Answers from your records and tested calculations. It does not invent financial numbers."
          />
        </Group>
      </Section>

      <Section title="The privacy boundary">
        <View style={styles.privacy}>
          <Text variant="heading">Raw records stay here.</Text>
          <Text color={colors.textSoft}>
            The local models use totals and patterns already on this device. Lender names, pasted
            messages, screenshots and check-ins are not uploaded for these results.
          </Text>
          <View style={styles.rule} />
          <Text variant="small" color={colors.textMuted}>
            Ask Ginto also works on this device. It answers from your records and calculations; it
            cannot read photos or connect to your bank.
          </Text>
        </View>
      </Section>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: 58, lineHeight: 62, letterSpacing: -2 },
  privacy: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
