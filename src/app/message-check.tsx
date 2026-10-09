import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { Button, Card, Field, Rise, Row, Screen, ScreenHeader, Tag, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { analyzeAndroidMessageRisk, supportsAndroidMessageRiskAnalysis } from '@/ai/androidLocalAi';
import { logEvent } from '@/db/events';
import { listNumberReports } from '@/db/numberReports';
import { addEvidence } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { assessMessage, highlightParts, type MessageRisk } from '@/domain/messageRisk';
import { matchesInText, summarizeNumbers } from '@/domain/numberLog';
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
  const { data: numberReports } = useDbQuery(listNumberReports, []);
  const numberSummaries = useMemo(() => summarizeNumbers(numberReports), [numberReports]);
  const showToast = useSession((s) => s.showToast);
  const { text: sharedText } = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState('');
  const [lender, setLender] = useState('');
  const [result, setResult] = useState<{ text: string; risk: MessageRisk } | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analysisId = useRef(0);
  const pasteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
    },
    [],
  );

  const check = async (message = text) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    if (pasteTimer.current) {
      clearTimeout(pasteTimer.current);
      pasteTimer.current = null;
    }

    const requestId = ++analysisId.current;
    const risk = assessMessage(cleanMessage);
    setResult({ text: cleanMessage, risk });
    setAiText(null);
    setAiStatus(null);
    setAnalyzing(true);
    void logEvent(db, 'message_scanned', { risk: risk.level, signals: risk.signals.length });

    if (!supportsAndroidMessageRiskAnalysis()) {
      setAiStatus('Local AI analysis is available in the Android app.');
      setAnalyzing(false);
      return;
    }

    try {
      const analysis = await analyzeAndroidMessageRisk(cleanMessage);
      if (requestId !== analysisId.current) return;
      if (analysis) setAiText(analysis.text);
      else setAiStatus('Download a text model in Chat settings.');
    } catch {
      if (requestId === analysisId.current)
        setAiStatus('Local analysis is unavailable. Try again.');
    } finally {
      if (requestId === analysisId.current) setAnalyzing(false);
    }
  };

  const updateText = (next: string) => {
    const previous = text;
    let prefix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < previous.length - prefix &&
      suffix < next.length - prefix &&
      previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
    ) {
      suffix++;
    }
    const insertedLength = next.length - prefix - suffix;

    if (pasteTimer.current) clearTimeout(pasteTimer.current);
    analysisId.current++;
    setText(next);
    setResult(null);
    setAiText(null);
    setAiStatus(null);
    setAnalyzing(false);

    // Native TextInput does not expose a cross-platform paste event. A multi-character
    // insertion catches the Android paste gesture; the button below covers short pastes.
    if (insertedLength > 1 && next.trim()) {
      pasteTimer.current = setTimeout(() => void check(next), 500);
    }
  };

  // Text shared from Messages ("Share to Unhooked") is checked right away.
  const handledShare = useRef<string | null>(null);
  useEffect(() => {
    const shared = sharedText?.trim();
    if (!shared || handledShare.current === shared) return;
    handledShare.current = shared;
    setText(shared);
    void check(shared);
    // check reads only its argument and stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedText]);

  const pasteAndAnalyze = async () => {
    try {
      const pasted = (await Clipboard.getStringAsync()).trim();
      if (!pasted) {
        showToast('Copy a message first.');
        return;
      }
      if (pasteTimer.current) clearTimeout(pasteTimer.current);
      setText(pasted);
      void check(pasted);
    } catch {
      showToast('Could not read the clipboard.');
    }
  };

  const addSample = () => {
    setText(SAMPLE);
    void check(SAMPLE);
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

  const loggedNumbers = result ? matchesInText(result.text, numberSummaries) : [];

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Scan a message"
        subtitle="AI risk analysis stays on your phone."
        mascot={result ? (result.risk.level === 'low' ? 'happy' : 'brave') : 'thinking'}
      />

      <Field
        label="Paste the message"
        placeholder="Paste a text from a lender or collector…"
        value={text}
        onChangeText={updateText}
        multiline
        style={{ minHeight: 120, paddingTop: spacing.md, textAlignVertical: 'top' }}
      />
      <Row>
        <Button
          label="Paste & analyze"
          kind="outline"
          icon="paste"
          onPress={() => void pasteAndAnalyze()}
          style={{ flex: 1 }}
        />
        {!text && <Button label="Sample" kind="ghost" size="sm" icon="file" onPress={addSample} />}
      </Row>
      {!!text.trim() && <Button label="Analyze risk" icon="shield" onPress={() => void check()} />}

      {result && (
        <Rise style={{ gap: spacing.md }}>
          {loggedNumbers.length ? (
            <Card tone={colors.surfaceMuted} flat style={{ gap: spacing.sm }}>
              <Tag certainty="fact" label="From your number log" />
              <Text variant="strong">
                {loggedNumbers.length === 1 ? 'A number in this text' : 'Numbers in this text'}{' '}
                matches your saved reports.
              </Text>
              {loggedNumbers.map((entry) => (
                <Text key={entry.number} variant="small" selectable>
                  {entry.number} · last seen {entry.lastSeenOn}
                  {entry.agentName ? ` · noted as ${entry.agentName}` : ''}
                </Text>
              ))}
              <Text variant="caption">
                The match does not prove who sent this message; it may be a payment number.
              </Text>
            </Card>
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={[styles.level, { backgroundColor: LEVEL[result.risk.level].bg }]}>
              <Text variant="strong" color={LEVEL[result.risk.level].fg}>
                {LEVEL[result.risk.level].label}
              </Text>
            </View>
            <Tag label="Indication, not proof" tone="records" />
          </Row>

          <Card style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="strong">AI analysis</Text>
              {aiText ? <Tag label="Local text model" tone="records" /> : null}
            </Row>
            {analyzing ? (
              <Text variant="small" color={colors.text}>
                Analyzing message on this phone…
              </Text>
            ) : aiText ? (
              <Text variant="small" color={colors.text}>
                {aiText}
              </Text>
            ) : (
              <Text variant="small">{aiStatus ?? 'Preparing local analysis…'}</Text>
            )}
          </Card>

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
