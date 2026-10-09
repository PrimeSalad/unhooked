import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { Button, Field, Rise, Row, ScreenHeader, Tag, Text } from '@/components/ui';
import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { addEvidence } from '@/db/repo';
import { assessMessage, highlightParts, type MessageRisk } from '@/domain/messageRisk';
import { useSession } from '@/store/session';
import { useAsyncAction } from '@/hooks/useAsyncAction';

const SAMPLE =
  'PAY NOW OR WE WILL CONTACT YOUR FAMILY AND POST YOUR INFORMATION. Last warning today. Send to GCash 0917 123 4567.';

const LEVEL = {
  high: { label: 'High risk', bg: colors.danger, fg: colors.white },
  medium: { label: 'Some warning signs', bg: colors.surfaceMuted, fg: colors.link },
  low: { label: 'Low risk', bg: colors.surfaceMuted, fg: colors.success },
} as const;

const MODEL_LABEL = {
  safe: 'Normal reminder pattern',
  pressure: 'Payment pressure pattern',
  harassment: 'Harassment pattern',
  phishing: 'Suspicious payment pattern',
} as const;

export default function MessageCheckScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const action = useAsyncAction();
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState(false);
  const [text, setText] = useState('');
  const [lender, setLender] = useState('');
  const [result, setResult] = useState<{ text: string; risk: MessageRisk } | null>(null);

  const check = () => {
    const risk = assessMessage(text);
    setResult({ text, risk });
    setSaved(false);
    void logEvent(db, 'message_scanned', {
      risk: risk.level,
      signals: risk.signals.length,
      localClass: risk.model.category,
      confidence: risk.model.confidence,
      modelVersion: risk.model.modelVersion,
    }).catch(() => showToast('The scan is ready, but its activity record could not be saved.'));
  };

  const save = async () => {
    if (!result) return;
    await addEvidence(db, {
      lender: lender.trim() || 'Unknown sender',
      messageText: result.text,
      riskLevel: result.risk.level,
    });
    setSaved(true);
    showToast('Saved to your private Evidence Pack.');
  };

  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="Read past the pressure."
        subtitle="Check a lender’s message for warning signs, privately."
      />

      <Field
        label="Paste the message"
        placeholder="Paste a text from a lender or collector…"
        value={text}
        onChangeText={(t) => {
          setText(t);
          setResult(null);
          setSaved(false);
          action.clearError();
        }}
        multiline
        style={{ minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }}
      />
      {!text && (
        <Button
          label="Try a sample message"
          kind="ghost"
          size="sm"
          icon="chat"
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

          <Button
            label={details ? 'Hide how this was checked' : 'How was this checked?'}
            kind="ghost"
            size="sm"
            onPress={() => setDetails(!details)}
          />
          {details && (
            <View style={styles.modelRead}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Tag label="On-device classifier" tone="calculated" />
                <Text variant="caption" color={colors.textSoft}>
                  {Math.round(result.risk.model.confidence * 100)}% pattern match
                </Text>
              </Row>
              <Text variant="strong">{MODEL_LABEL[result.risk.model.category]}</Text>
              <Text variant="caption">
                {result.risk.model.matchedTokens.length
                  ? `Matched locally: ${result.risk.model.matchedTokens.join(', ')}`
                  : 'No strong learned phrase matched. Exact safety rules still checked the text.'}
              </Text>
            </View>
          )}

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

          <FormSection title="What stands out">
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
          </FormSection>

          {result.risk.level !== 'low' && (
            <View
              style={{
                gap: spacing.md,
                padding: spacing.lg,
                backgroundColor: colors.surfaceMuted,
                borderRadius: radius.md,
              }}
            >
              <Text variant="heading">Give yourself room to verify.</Text>
              <Text variant="small">
                Do not send money to personal numbers. Keep the message as evidence. Abusive
                collection by lending apps can be reported to the SEC, and threats to the PNP
                Anti-Cybercrime Group.
              </Text>
            </View>
          )}
          <FormSection
            title="Keep a private copy"
            description="Save the original message in your Evidence Pack for your own records."
          >
            <Field
              label="Who sent it? (optional)"
              placeholder="Lending app or number"
              value={lender}
              onChangeText={setLender}
            />
            <ActionError message={action.error} />
            <Button
              label={saved ? 'Saved to your evidence' : 'Save as evidence'}
              kind="ink"
              icon={saved ? 'check' : 'shield'}
              disabled={saved}
              loading={action.pending}
              onPress={() => void action.run(save)}
            />
          </FormSection>
        </Rise>
      )}
      <Text variant="caption">
        A pattern check can miss context. A low-risk result does not verify the sender or make a
        payment request safe.
      </Text>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  level: { borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 14 },
  modelRead: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  message: {
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  messageText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.text },
  highlight: { backgroundColor: '#FFD3CC', color: '#7A140C', fontFamily: fonts.semibold },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: 6 },
});
