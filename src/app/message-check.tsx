import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform, StyleSheet, Text as RNText, View } from 'react-native';

import { Button, Card, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { demoMessage } from '@/demo/ana';
import { useSession } from '@/store/session';

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export default function MessageCheckScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [scanned, setScanned] = useState(false);

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Check a message"
        subtitle="Checked on your phone. Nothing is sent."
        mascot={scanned ? 'brave' : 'thinking'}
      />

      <View style={styles.message}>
        <Text variant="eyebrow" style={{ fontSize: 10.5, marginBottom: 6 }}>
          Sample message
        </Text>
        <RNText style={styles.messageText}>
          {demoMessage.parts.map((p, i) =>
            p.flag && scanned ? (
              <RNText key={i} style={styles.highlight}>
                {p.text}
              </RNText>
            ) : (
              <RNText key={i}>{p.text}</RNText>
            ),
          )}
        </RNText>
      </View>

      {!scanned ? (
        <Button
          label="Check for warning signs"
          icon="shield-checkmark-outline"
          onPress={() => {
            setScanned(true);
            void logEvent(db, 'message_scanned', { risk: 'high', sample: true });
          }}
        />
      ) : (
        <Rise style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={styles.risk}>
              <Text variant="strong" color={colors.white}>
                High risk
              </Text>
            </View>
            <Tag label="Indication, not proof" tone="records" />
          </Row>
          <Card style={{ gap: spacing.md }}>
            {demoMessage.signals.map((g) => (
              <Row key={g.label} style={{ alignItems: 'flex-start' }} gap={10}>
                <View style={styles.dot} />
                <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                  <Text variant="small" color={colors.text} style={{ fontFamily: fonts.semibold }}>
                    {g.label}.{' '}
                  </Text>
                  {g.text}
                </Text>
              </Row>
            ))}
          </Card>
          <Row gap={10}>
            <Button
              label="Save to Evidence"
              kind="ink"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => showToast('Saving to the Evidence Pack arrives in Phase 2.')}
            />
            <Button
              label="How to report"
              kind="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => router.push('/help')}
            />
          </Row>
        </Rise>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E2CDB9',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  messageText: { fontFamily: mono, fontSize: 13, lineHeight: 21, color: '#3B1E08' },
  highlight: { backgroundColor: '#FFD3CC', color: '#7A140C', fontWeight: '700' },
  risk: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 6 },
});
