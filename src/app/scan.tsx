// Utang Scanner: screenshot or pasted text from a loan app -> debt fields, lender check,
// collector warning signs, Evidence Pack and a draft SEC complaint.

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Field,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Tag,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { addDebt, addEvidence, evidenceSummary } from '@/db/repo';
import { formatPHP, parsePesoInput, toPesos } from '@/domain/money';
import { LENDER_CHECK_COPY, lenderCheck, scanLoanText, type LoanScan } from '@/domain/utangScan';
import { readImageText } from '@/lib/ocr';
import { exportSecComplaint } from '@/lib/secComplaint';
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

export default function ScanScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [image, setImage] = useState<{ uri: string; mimeType: string | null } | null>(null);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [scan, setScan] = useState<LoanScan | null>(null);
  const [lender, setLender] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [saved, setSaved] = useState({ debt: false, evidence: false });

  const run = (raw: string) => {
    const s = scanLoanText(raw);
    setScan(s);
    setLender(s.lender ?? '');
    setAmount(s.amount ? String(toPesos(s.amount)) : '');
    setDue(s.dueDate ?? '');
    setSaved({ debt: false, evidence: false });
  };

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setImage({ uri: asset.uri, mimeType: asset.mimeType ?? null });
      setReading(true);
      const found = await readImageText(asset.uri);
      setReading(false);
      if (found) {
        setText(found);
        run(found);
      } else {
        showToast('Could not read text here. Paste it below instead.');
      }
    } catch {
      setReading(false);
      showToast('Could not open your images. Please try again.');
    }
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

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Utang scanner"
        subtitle="Screenshot your loan app. I fill in the debt and check what the lender shows."
      />

      <Card>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.thumb} resizeMode="cover" />
        ) : null}
        <Button
          label={
            reading
              ? 'Reading the screenshot…'
              : image
                ? 'Choose another screenshot'
                : 'Choose a screenshot'
          }
          kind="outline"
          icon="images"
          disabled={reading}
          onPress={() => void pick()}
        />
        <Field
          label="Or paste the text"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Total amount due ₱3,000 · Due Oct 15 · SEC Reg. No. …"
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
        <Button label="Read it" kind="ink" disabled={!text.trim()} onPress={() => run(text)} />
        <Text variant="caption">Read on this phone. Nothing is uploaded.</Text>
      </Card>

      {scan && (
        <>
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
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="strong">{CHECK_TITLE[check]}</Text>
                <Tag certainty="fact" />
              </Row>
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
        </>
      )}
    </Screen>
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
  thumb: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  nums: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
