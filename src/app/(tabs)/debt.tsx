import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  ProgressBar,
  Rise,
  Row,
  Screen,
  ScreenHeader,
  Segmented,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { demoDebtTotals, demoOwe, demoOwed, type DemoDebt } from '@/demo/ana';
import { useSession } from '@/store/session';

function DebtCard({ d, owed }: { d: DemoDebt; owed: boolean }) {
  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="strong">{d.name}</Text>
          <Text variant="caption">{d.sub}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="heading">{d.amount}</Text>
          <Text variant="caption" color={d.urgent ? colors.spend : colors.textMuted}>
            {d.due}
          </Text>
        </View>
      </Row>
      <ProgressBar
        value={d.progress}
        color={owed ? colors.success : d.urgent ? colors.primarySoft : colors.accent}
      />
      <Text variant="caption" color={colors.textSoft}>
        {d.note}
      </Text>
    </Card>
  );
}

export default function DebtScreen() {
  const [tab, setTab] = useState<'owe' | 'owed'>('owe');
  const showToast = useSession((s) => s.showToast);
  const owed = tab === 'owed';
  const list = owed ? demoOwed : demoOwe;

  return (
    <Screen>
      <ScreenHeader title="Debt" subtitle="What you owe, and what you are owed." mascot="happy" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owe', label: 'I owe' },
          { value: 'owed', label: 'Owed to me' },
        ]}
      />

      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Text variant="small" color={colors.textMuted}>
          {owed ? 'Owed to you' : 'Left to pay'}
        </Text>
        <Text variant="heading" style={{ fontSize: 22 }}>
          {owed ? demoDebtTotals.owed : demoDebtTotals.owe}
        </Text>
      </Row>

      <View key={tab} style={{ gap: spacing.md }}>
        {list.map((d, i) => (
          <Rise key={d.name} delay={i * 60}>
            <DebtCard d={d} owed={owed} />
          </Rise>
        ))}
      </View>

      <Rise delay={200}>
        <View
          style={{
            backgroundColor: colors.text,
            borderRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" color={colors.bg}>
                Evidence Pack
              </Text>
              <Text variant="caption" color="#D9BFA8">
                6 screenshots · 2 lenders · stays on this phone
              </Text>
            </View>
            <Ionicons name="document-lock-outline" size={28} color={colors.accent} />
          </Row>
          <Row gap={10}>
            <Button
              label="Export PDF"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => showToast('PDF export arrives in Phase 2.')}
            />
            <Button
              label="Scan message"
              size="sm"
              kind="outlineLight"
              style={{ flex: 1 }}
              onPress={() => router.push('/message-check')}
            />
          </Row>
        </View>
      </Rise>

      <Button
        label="I am thinking of borrowing"
        kind="outline"
        onPress={() => router.push({ pathname: '/pause', params: { kind: 'borrow' } })}
      />
    </Screen>
  );
}
