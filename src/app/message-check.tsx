import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { Button, Card, Field, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { addEvidence } from '@/db/repo';
import { assessMessage, highlightParts, type MessageRisk } from '@/domain/messageRisk';
import { useSession } from '@/store/session';

const SAMPLE =
  'PAY NOW OR WE WILL CONTACT YOUR FAMILY AND POST YOUR INFORMATION. Last warning today. Send to GCash 0917 123 4567.';

const LEVEL = {
  high: { label: 'High risk', bg: colors.danger, fg: colors.white },
  medium: { label: 'Some warning signs', bg: '#F3ECE4', fg: '#7A4A00' },
  low: { label: 'Low risk', bg: '#F3ECE4', fg: '#1E5E3B' },
} as const;

export default function MessageCheckScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [text, setText] = useState('');
  const [lender, setLender] = useState('');
  const [result, setResult] = useState<{ text: string; risk: MessageRisk } | null>(null);

  const check = () => {
    const risk = assessMessage(text);
    setResult({ text, risk });
    void logEvent(db, 'message_scanned', { risk: risk.level, signals: risk.signals.length });
  };

  const save = async () => {
    if (!result) return;
    await addEvidence(db, {
      lender: lender.trim() || 'Unknown sender',
      messageText: result.text,
      riskLevel: result.risk.level,
    });
    showToast('Saved to your private Evidence Pack.');
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Scan a message"
        subtitle="Checked on your phone. Nothing is sent."
        mascot={result ? (result.risk.level === 'low' ? 'happy' : 'brave') : 'thinking'}
      />

      <Field
        label="Paste the message"
        placeholder="Paste a text from a lender or collector…"
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
        }}
        multiline
        style={{ minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }}
      />
      {!text && (
        <Button
          label="Try a sample message"
          kind="ghost"
          size="sm"
          icon="file"
          onPress={() => setText(SAMPLE)}
        />
      )}
      {!result && (
        <Button
          label="Check for warning signs"
          icon="shield"
          disabled={!text.trim()}
          onPress={check}
        />
      )}

      {result && (
        <Rise style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={[styles.level, { backgroundColor: LEVEL[result.risk.level].bg }]}>
              <Text variant="strong" color={LEVEL[result.risk.level].fg}>
                {LEVEL[result.risk.level].label}
              </Text>
            </View>
            <Tag label="Indication, not proof" tone="records" />
          </Row>

          {result.risk.signals.length > 0 && (
            <View style={styles.message}>
              <RNText style={styles.messageText}>
                {highlightParts(result.text, result.risk.signals).map((p, i) =>
                  p.flag ? (
                    <RNText key={i} style={styles.highlight}>
                      {p.text}
                    </RNText>
                  ) : (
                    <RNText key={i}>{p.text}</RNText>
                  ),
                )}
              </RNText>
            </View>
          )}

          <Card style={{ gap: spacing.md }}>
            {result.risk.signals.length === 0 ? (
              <Text variant="small" color={colors.text}>
                {result.risk.explanation}
              </Text>
            ) : (
              result.risk.signals.map((g) => (
                <Row key={g.label} style={{ alignItems: 'flex-start' }} gap={10}>
                  <View style={styles.dot} />
                  <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                    <Text
                      variant="small"
                      color={colors.text}
                      style={{ fontFamily: fonts.semibold }}
                    >
                      {g.label}.{' '}
                    </Text>
                    {g.explanation}
                  </Text>
                </Row>
              ))
            )}
          </Card>

          {result.risk.level !== 'low' && (
            <Card tone={colors.surfaceMuted} flat style={{ gap: spacing.md }}>
              <Text variant="strong">What you can do</Text>
              <Text variant="small">
                Do not send money to personal numbers. Keep the message as evidence. Abusive
                collection by lending apps can be reported to the SEC, and threats to the PNP
                Anti-Cybercrime Group.
              </Text>
              <Field
                label="Who sent it? (optional)"
                placeholder="Lending app or number"
                value={lender}
                onChangeText={setLender}
              />
              <Row gap={10}>
                <Button
                  label="Save as evidence"
                  kind="ink"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => void save()}
                />
              </Row>
            </Card>
          )}
        </Rise>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  level: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
  message: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E2CDB9',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  messageText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: '#3B1E08' },
  highlight: { backgroundColor: '#FFD3CC', color: '#7A140C', fontFamily: fonts.semibold },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 6 },
});
