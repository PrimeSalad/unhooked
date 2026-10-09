import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { demoPurchase as p } from '@/demo/ana';
import { useSession } from '@/store/session';

export default function SpendScreen() {
  const cooling = useSession((s) => s.cooling);

  return (
    <Screen>
      <ScreenHeader title="Spend" subtitle="Check it before you check out." mascot="thinking" />

      {cooling > 0 && (
        <Rise>
          <Card tone={colors.shell} flat>
            <Row>
              <Ionicons name="time-outline" size={22} color={colors.lagoon} />
              <View style={{ flex: 1 }}>
                <Text variant="strong">Earbuds are cooling off</Text>
                <Text variant="caption" color={colors.lagoon}>
                  I will check in tomorrow at 11:40 PM.
                </Text>
              </View>
            </Row>
          </Card>
        </Rise>
      )}

      <Rise>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="eyebrow" style={{ fontSize: 11 }}>
              Planned purchase
            </Text>
            <Tag label="Want" tone="records" />
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Text variant="heading">{p.item}</Text>
              <Text variant="caption">{p.when}</Text>
            </View>
            <Text variant="number">{p.price}</Text>
          </Row>
        </Card>
      </Rise>

      <Rise delay={60}>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="strong">Can I afford it?</Text>
            <Tag tone="estimate" />
          </Row>
          <View
            style={{
              flexDirection: 'row',
              height: 14,
              borderRadius: radius.pill,
              overflow: 'hidden',
              backgroundColor: colors.track,
            }}
          >
            <View style={{ flex: p.leftAfterShare, backgroundColor: colors.success }} />
            <View style={{ flex: 1 - p.leftAfterShare, backgroundColor: colors.primarySoft }} />
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textSoft}>
              {p.leftAfter} left after
            </Text>
            <Text variant="caption" color={colors.textSoft}>
              {p.price} purchase
            </Text>
          </Row>
          <Row
            style={{
              alignItems: 'flex-start',
              backgroundColor: '#FFF4E8',
              borderRadius: radius.md,
              padding: spacing.md,
            }}
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.spend} />
            <Text variant="small" color={colors.text} style={{ flex: 1 }}>
              {p.conflict}
            </Text>
          </Row>
        </Card>
      </Rise>

      <Rise delay={120}>
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="strong">If you pay later</Text>
            <Tag tone="calculated" />
          </Row>
          <Text variant="small">{p.bnpl.plan}</Text>
          <Row gap={spacing.sm} style={{ flexWrap: 'wrap', alignItems: 'baseline' }}>
            <Text variant="heading" style={{ fontSize: 20 }}>
              {p.bnpl.total}
            </Text>
            <Text variant="strong" color={colors.spend} style={{ fontSize: 13 }}>
              {p.bnpl.extra}
            </Text>
          </Row>
        </Card>
      </Rise>

      <Rise delay={180}>
        <Button
          label="Check out"
          icon="arrow-forward"
          onPress={() => router.push({ pathname: '/pause', params: { kind: 'checkout' } })}
        />
      </Rise>
    </Screen>
  );
}
