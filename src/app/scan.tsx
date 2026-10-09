// Utang Scanner: screenshot or pasted text from a loan app -> debt fields, lender check,
// collector warning signs, Evidence Pack and a draft SEC complaint.

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import {
  Button,
  Card,
  Field,
  IconButton,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Tag,
  Text,
} from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { addDebt, addEvidence, evidenceSummary } from '@/db/repo';
import { formatPHP, parsePesoInput, toPesos } from '@/domain/money';
import { LENDER_CHECK_COPY, lenderCheck, scanLoanText, type LoanScan } from '@/domain/utangScan';
import { readImageText, type OcrProgress } from '@/lib/ocr';
import { exportSecComplaint } from '@/lib/secComplaint';
import { shortDate } from '@/lib/format';
import { useSession } from '@/store/session';

const CHECK_TITLE = {
  both: 'Both SEC numbers shown',
  partial: 'One SEC number missing',
  none: 'No SEC numbers shown',
} as const;

const RISK_TITLE = {
  low: 'No strong warning signs',
  medium: 'Some warning signs',
  high: 'Harassment warning signs',
} as const;

type Picked = { uri: string; mimeType: string | null };

export default function ScanScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [image, setImage] = useState<Picked | null>(null);
  const [viewing, setViewing] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [scan, setScan] = useState<LoanScan | null>(null);
  const [lender, setLender] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [saved, setSaved] = useState({ debt: false, evidence: false });
  const reading = !!progress && progress.value !== 1;

  const run = (raw: string) => {
    const s = scanLoanText(raw);
    setScan(s);
    setLender(s.lender ?? '');
    setAmount(s.amount ? String(toPesos(s.amount)) : '');
    setDue(s.dueDate ?? '');
    setSaved({ debt: false, evidence: false });
  };

  const readImage = async (picked: Picked) => {
    setFailed(false);
    setScan(null);
    setProgress({ label: 'Opening the screenshot', value: 0 });
    const found = await readImageText(picked.uri, setProgress);
    setProgress(null);
    if (found) {
      setText(found);
      run(found);
    } else {
      setFailed(true);
      setPasting(true);
    }
  };

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      const picked = { uri: asset.uri, mimeType: asset.mimeType ?? null };
      setImage(picked);
      await readImage(picked);
    } catch {
      setProgress(null);
      showToast('Could not open your images. Please try again.');
    }
  };

  const startOver = () => {
    setImage(null);
    setScan(null);
    setText('');
    setFailed(false);
    setPasting(false);
    setShowText(false);
  };

  const amountC = parsePesoInput(amount);
  const dueOk = !due || /^\d{4}-\d{2}-\d{2}$/.test(due);

  const saveDebt = async () => {
    if (!amountC || !lender.trim() || !dueOk) return;
    try {
      await addDebt(db, {
        direction: 'owed',
        counterparty: lender.trim(),
        principal: amountC,
        dueDate: due || null,
        interestRatePct: null,
        notes: 'Added from a screenshot',
      });
      setSaved((v) => ({ ...v, debt: true }));
      showToast(`Added ${formatPHP(amountC)} owed to ${lender.trim()}.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add it.');
    }
  };

  const saveEvidence = async () => {
    if (!scan) return;
    try {
      await addEvidence(db, {
        lender: lender.trim() || 'Unknown lender',
        messageText: text,
        riskLevel: scan.risk.level,
        imageUri: image?.uri ?? null,
        imageMimeType: image?.mimeType ?? null,
        note: 'Saved from the Utang scanner',
      });
      setSaved((v) => ({ ...v, evidence: true }));
      showToast('Saved to your Evidence Pack.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save it.');
    }
  };

  const draft = async () => {
    if (!scan) return;
    try {
      await exportSecComplaint({
        lender: lender.trim() || 'Unknown lender',
        amount: amountC,
        dueDate: due || null,
        secReg: scan.secReg,
        caNumber: scan.caNumber,
        signals: scan.risk.signals.map((s) => s.label),
        messageText: text,
        evidenceCount: (await evidenceSummary(db)).count,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not make the PDF.');
    }
  };

  const check = scan ? lenderCheck(scan) : 'none';
  const risky = !!scan && scan.risk.level !== 'low';
  const found = scan
    ? [
        scan.lender && { label: 'Lender', value: scan.lender },
        scan.amount && { label: 'Amount', value: formatPHP(scan.amount) },
        scan.dueDate && { label: 'Due', value: shortDate(scan.dueDate) },
      ].filter((f): f is { label: string; value: string } => !!f)
    : [];

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Utang scanner"
        subtitle="Add a screenshot from your loan app. I fill in the debt and check what the lender shows."
      />

      {!image ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a screenshot"
          onPress={() => void pick()}
          style={({ pressed }) => [styles.drop, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.dropIcon}>
            <Icon name="scan" size={30} color={colors.text} />
          </View>
          <Text variant="heading" align="center">
            Add a screenshot
          </Text>
          <Text variant="small" align="center" color={colors.textMuted}>
            The loan details or a collector&apos;s message. It is read on this device and never
            uploaded.
          </Text>
          <View style={styles.dropButton}>
            <Icon name="images" size={18} color={colors.bg} />
            <Text variant="strong" color={colors.bg}>
              Choose from photos
            </Text>
          </View>
        </Pressable>
      ) : (
        <Card style={{ gap: spacing.md }}>
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel="View the screenshot"
            onPress={() => setViewing(true)}
          >
            <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.viewChip}>
              <Icon name="expand" size={14} color={colors.bg} />
              <Text variant="caption" color={colors.bg} style={{ fontFamily: fonts.semibold }}>
                View
              </Text>
            </View>
          </Pressable>

          {progress ? (
            <ReadingProgress progress={progress} />
          ) : (
            <Row style={{ gap: spacing.sm }}>
              <Button
                label="Change"
                kind="outline"
                size="sm"
                icon="images"
                style={{ flex: 1 }}
                onPress={() => void pick()}
              />
              <Button
                label="Read again"
                kind="outline"
                size="sm"
                icon="refresh"
                style={{ flex: 1 }}
                onPress={() => void readImage(image)}
              />
            </Row>
          )}

          {failed ? (
            <Text variant="small" color={colors.textMuted}>
              I could not read the text in this screenshot. Type or paste what it says below.
            </Text>
          ) : null}
        </Card>
      )}

      {!scan && !reading && (
        <>
          {pasting ? (
            <Card>
              <Field
                label="Paste or type the text"
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Total amount due ₱3,000 · Due Oct 15 · SEC Reg. No. …"
                style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
              />
              <Button
                label="Read it"
                kind="ink"
                icon="scan"
                disabled={!text.trim()}
                onPress={() => run(text)}
              />
            </Card>
          ) : (
            <Button
              label="Paste text instead"
              kind="ghost"
              icon="paste"
              onPress={() => setPasting(true)}
            />
          )}
        </>
      )}

      {scan && (
        <>
          <Card tone={colors.shell} flat style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="strong">
                {found.length ? `Found ${found.length} of 3 details` : 'No loan details found'}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setShowText((v) => !v)}>
                <Text variant="caption" style={{ fontFamily: fonts.semibold }}>
                  {showText ? 'Hide text' : 'See text'}
                </Text>
              </Pressable>
            </Row>
            {found.length ? (
              <View style={styles.chips}>
                {found.map((f) => (
                  <View key={f.label} style={styles.chip}>
                    <Text variant="caption">{f.label}</Text>
                    <Text variant="strong">{f.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="small" color={colors.textMuted}>
                Fill in the details below, or check that the text was read right.
              </Text>
            )}
            {showText ? (
              <>
                <Field
                  label="Text I read"
                  value={text}
                  onChangeText={setText}
                  multiline
                  style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
                />
                <Button
                  label="Read this text again"
                  kind="outline"
                  size="sm"
                  icon="refresh"
                  disabled={!text.trim()}
                  onPress={() => run(text)}
                />
              </>
            ) : null}
          </Card>

          <Section title="Debt details">
            <Card>
              <Field
                label="Lender"
                value={lender}
                onChangeText={setLender}
                placeholder="App or company name"
              />
              <Field
                label="Amount to pay"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="3000"
              />
              <Field
                label="Due date"
                value={due}
                onChangeText={setDue}
                placeholder="YYYY-MM-DD"
                hint={dueOk ? 'Check these against the app before saving.' : 'Use YYYY-MM-DD.'}
              />
              <Button
                label={saved.debt ? 'Added to Debt' : 'Add to Debt'}
                kind="ink"
                icon={saved.debt ? 'check' : 'add'}
                disabled={saved.debt || !amountC || !lender.trim() || !dueOk}
                onPress={() => void saveDebt()}
              />
              {saved.debt ? (
                <Button
                  label="See my debts"
                  kind="ghost"
                  size="sm"
                  onPress={() => router.replace('/debt')}
                />
              ) : null}
            </Card>
          </Section>

          <Section title="Is this lender legit?">
            <Card>
              <Text variant="strong">{CHECK_TITLE[check]}</Text>
              <View style={styles.nums}>
                <Num label="SEC registration" value={scan.secReg} />
                <Num label="Certificate of Authority" value={scan.caNumber} />
              </View>
              <Text variant="small" color={colors.textMuted}>
                {LENDER_CHECK_COPY[check]}
              </Text>
              <Button
                label="Check on the SEC website"
                kind="outline"
                icon="globe"
                onPress={() => void Linking.openURL('https://www.sec.gov.ph')}
              />
            </Card>
          </Section>

          <Section title="Collector messages">
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text
                  variant="strong"
                  color={scan.risk.level === 'high' ? colors.danger : colors.text}
                >
                  {RISK_TITLE[scan.risk.level]}
                </Text>
                <Tag certainty="estimate" />
              </Row>
              {scan.risk.signals.map((s) => (
                <Text key={s.label} variant="small" color={colors.textMuted}>
                  {s.label}: {s.explanation}
                </Text>
              ))}
              <Text variant="caption">{scan.risk.explanation}</Text>
              {risky ? (
                <Button
                  label={saved.evidence ? 'Saved to Evidence Pack' : 'Save to Evidence Pack'}
                  kind="outline"
                  icon={saved.evidence ? 'check' : 'images'}
                  disabled={saved.evidence}
                  onPress={() => void saveEvidence()}
                />
              ) : null}
              {risky || check !== 'both' ? (
                <Button
                  label="Draft an SEC complaint"
                  kind="ink"
                  icon="file"
                  onPress={() => void draft()}
                />
              ) : null}
            </Card>
          </Section>

          <Button label="Scan another" kind="ghost" icon="refresh" onPress={startOver} />
        </>
      )}

      {image ? (
        <ImageViewer uri={image.uri} open={viewing} onClose={() => setViewing(false)} />
      ) : null}
    </Screen>
  );
}

/** Real percentage when the reader reports it (web); a moving bar when it cannot (ML Kit). */
function ReadingProgress({ progress }: { progress: OcrProgress }) {
  const slide = useState(() => new Animated.Value(0))[0];
  const indeterminate = progress.value == null;
  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, slide]);

  return (
    <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="strong">{progress.label}…</Text>
        {progress.value != null ? (
          <Text variant="strong">{Math.round(progress.value * 100)}%</Text>
        ) : null}
      </Row>
      {indeterminate ? (
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.runner,
              {
                transform: [
                  {
                    translateX: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-140, 340],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      ) : (
        <ProgressBar value={progress.value ?? 0} color={colors.text} height={10} />
      )}
      <Text variant="caption">Stays on this device. Keep this screen open.</Text>
    </View>
  );
}

function ImageViewer({ uri, open, onClose }: { uri: string; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri }} style={{ flex: 1, minHeight: 400 }} resizeMode="contain" />
        </ScrollView>
        <View style={[styles.viewerBar, { top: insets.top + spacing.sm }]}>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Num({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption">{label}</Text>
      <Text variant="strong" color={value ? colors.text : colors.textFaint}>
        {value ?? 'Not shown'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  drop: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  dropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  preview: {
    width: '100%',
    height: 260,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  viewChip: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(42,22,8,0.72)',
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  runner: { width: 120, height: '100%', borderRadius: radius.pill, backgroundColor: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  nums: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerBar: { position: 'absolute', right: spacing.lg },
});
