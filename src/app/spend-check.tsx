import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  Chips,
  Field,
  goBack,
  Rise,
  Row,
  Screen,
  ScreenHeader,
  Tag,
  Text,
} from '@/components/ui';
import { BudgetSetup } from '@/components/BudgetSetup';
import { colors, radius, spacing } from '@/constants/theme';
import { addPurchase, emptyOverview, getOverview, setPurchaseStatus } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { checkAffordability } from '@/domain/affordability';
import { calculateBnpl } from '@/domain/bnpl';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const VERDICT = {
  comfortable: { label: 'Looks affordable', bg: '#E5F2EA', fg: '#1E5E3B' },
  tight: { label: 'Tight', bg: '#FFF1C9', fg: '#7A4A00' },
  conflicts: { label: 'Clashes with repayments', bg: '#FBE3E0', fg: '#8C1D18' },
} as const;

export default function SpendCheckScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const budget = useSettings((s) => s.budget);
  const { data: o } = useDbQuery(getOverview, emptyOverview);

  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const [need, setNeed] = useState<'need' | 'want'>('want');
  const [alt, setAlt] = useState('');
  const [showBnpl, setShowBnpl] = useState(false);
  const [inst, setInst] = useState('');
  const [count, setCount] = useState('');
  const [fee, setFee] = useState('');

  const priceC = parsePesoInput(price);
  const altC = parsePesoInput(alt);
  const result =
    budget && priceC
      ? checkAffordability({
          price: priceC,
          budget,
          upcomingRepayments: o.dueThisMonth,
          spentThisMonth: o.spentThisMonth,
        })
      : null;
  const bnpl =
    priceC && parsePesoInput(inst)
      ? calculateBnpl({
          upfrontPrice: priceC,
          installmentAmount: parsePesoInput(inst) ?? 0,
          numberOfPayments: Number(count) || 0,
          fees: parsePesoInput(fee) ?? 0,
        })
      : null;
  const ready = item.trim().length > 0 && !!priceC;

  const reset = () => {
    setItem('');
    setPrice('');
    setAlt('');
    setInst('');
    setCount('');
    setFee('');
    setShowBnpl(false);
  };

  const checkout = async () => {
    if (!ready || !priceC) return;
    const id = await addPurchase(db, { item: item.trim(), price: priceC, isNeed: need === 'need' });
    reset();
    router.replace({ pathname: '/pause', params: { kind: 'checkout', purchaseId: id } });
  };

  const saveForLater = async () => {
    if (!ready || !priceC) return;
    const id = await addPurchase(db, { item: item.trim(), price: priceC, isNeed: need === 'need' });
    await setPurchaseStatus(db, id, 'cooling');
    void remindIn(
      24 * 3600,
      'Ready to decide?',
      'Something you saved yesterday is waiting for a decision.',
    );
    reset();
    goBack();
    showToast('Saved for 24 hours. I will check in with you tomorrow.');
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Check a purchase"
        subtitle="Before you check out, see what it really costs you."
      />

      {!budget && <BudgetSetup />}

      <Rise>
        <Card style={{ gap: spacing.md }}>
          <Text variant="strong">What are you thinking of buying?</Text>
          <Field
            label="Item"
            placeholder="Wireless earbuds, shoes, a game…"
            value={item}
            onChangeText={setItem}
          />
          <Field
            label="Price"
            placeholder="₱ 0"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
          <Chips
            value={need}
            onChange={setNeed}
            options={[
              { value: 'need', label: 'I need it' },
              { value: 'want', label: 'I want it' },
            ]}
          />
          <Field
            label="Cheaper option you found (optional)"
            placeholder="₱ 0"
            keyboardType="decimal-pad"
            value={alt}
            onChangeText={setAlt}
          />
        </Card>
      </Rise>

      {priceC && result && (
        <Rise>
          <Card style={{ gap: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View
                style={[
                  {
                    borderRadius: radius.pill,
                    paddingVertical: 5,
                    paddingHorizontal: 12,
                    backgroundColor: VERDICT[result.verdict].bg,
                  },
                ]}
              >
                <Text variant="strong" color={VERDICT[result.verdict].fg} style={{ fontSize: 13 }}>
                  {VERDICT[result.verdict].label}
                </Text>
              </View>
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
              <View
                style={{
                  flex: Math.max(0, result.remainingAfter),
                  backgroundColor: colors.success,
                }}
              />
              <View style={{ flex: priceC, backgroundColor: colors.primarySoft }} />
            </View>
            <Text variant="small" color={colors.text}>
              After {formatPHP(priceC)}, about {formatPHP(result.remainingAfter)} is left this month
              {o.dueThisMonth > 0
                ? `, with ${formatPHP(o.dueThisMonth)} in repayments still due.`
                : '.'}
            </Text>
            {result.shortfall > 0 && (
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
                  Your repayments would be about {formatPHP(result.shortfall)} short.
                </Text>
              </Row>
            )}
            {altC && altC < priceC && (
              <Row
                style={{
                  alignItems: 'flex-start',
                  backgroundColor: '#E5F2EA',
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Ionicons name="leaf-outline" size={20} color={colors.success} />
                <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                  The cheaper option keeps {formatPHP(priceC - altC)} in your pocket.
                </Text>
              </Row>
            )}
          </Card>
        </Rise>
      )}

      <Card style={{ gap: spacing.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="strong">Paying in installments?</Text>
            <Text variant="caption">See the true cost of buy-now-pay-later</Text>
          </View>
          <Button
            label={showBnpl ? 'Hide' : 'Calculate'}
            kind="outline"
            size="sm"
            onPress={() => setShowBnpl(!showBnpl)}
            style={{ minHeight: 36 }}
          />
        </Row>
        {showBnpl && (
          <>
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Each payment"
                  placeholder="₱ 0"
                  keyboardType="decimal-pad"
                  value={inst}
                  onChangeText={setInst}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="How many"
                  placeholder="6"
                  keyboardType="number-pad"
                  value={count}
                  onChangeText={setCount}
                />
              </View>
            </Row>
            <Field
              label="Fees (optional)"
              placeholder="₱ 0"
              keyboardType="decimal-pad"
              value={fee}
              onChangeText={setFee}
            />
            {bnpl ? (
              <View style={{ gap: 2 }}>
                <Tag tone="calculated" />
                <Row gap={spacing.sm} style={{ flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <Text variant="heading" style={{ fontSize: 22 }}>
                    {formatPHP(bnpl.totalRepayment)} total
                  </Text>
                  {bnpl.extraCost > 0 && (
                    <Text variant="strong" color={colors.spend} style={{ fontSize: 13 }}>
                      {formatPHP(bnpl.extraCost)} more ({bnpl.extraCostPct}%)
                    </Text>
                  )}
                </Row>
                <Text variant="caption">
                  {bnpl.extraCost > 0
                    ? 'than paying upfront.'
                    : 'Same as paying upfront. No hidden cost.'}
                </Text>
              </View>
            ) : (
              <Text variant="caption">Enter the price above, then each payment and how many.</Text>
            )}
          </>
        )}
      </Card>

      <Button
        label="Check out"
        icon="arrow-forward"
        disabled={!ready}
        onPress={() => void checkout()}
      />
      <Button
        label="Save for 24 hours instead"
        kind="outline"
        disabled={!ready}
        onPress={() => void saveForLater()}
      />
    </Screen>
  );
}
