import { Icon } from '@/components/Icon';
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
  ScreenHeader,
  Tag,
  Text,
} from '@/components/ui';
import { BudgetSetup } from '@/components/BudgetSetup';
import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { colors, radius, spacing } from '@/constants/theme';
import { addPurchase, emptyOverview, getOverview, setPurchaseStatus } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { checkAffordability } from '@/domain/affordability';
import { calculateBnpl } from '@/domain/bnpl';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useAsyncAction } from '@/hooks/useAsyncAction';

const VERDICT = {
  comfortable: { label: 'Looks affordable', bg: colors.surfaceMuted, fg: colors.success },
  tight: { label: 'Tight', bg: colors.surfaceMuted, fg: colors.link },
  conflicts: { label: 'Clashes with repayments', bg: colors.surfaceMuted, fg: colors.error },
} as const;

export default function SpendCheckScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const budget = useSettings((s) => s.budget);
  const { data: o, error, retry, loaded } = useDbQuery(getOverview, emptyOverview);
  const action = useAsyncAction();

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
    budget && priceC && loaded && !error
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
  const ready = item.trim().length > 0 && !!priceC && (!alt.trim() || altC !== null);

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
    await db.withTransactionAsync(async () => {
      const id = await addPurchase(db, {
        item: item.trim(),
        price: priceC,
        isNeed: need === 'need',
      });
      await setPurchaseStatus(db, id, 'cooling');
    });
    const reminder = await remindIn(
      24 * 3600,
      'Ready to decide?',
      'Something you saved yesterday is waiting for a decision.',
    );
    reset();
    goBack();
    showToast(
      reminder
        ? 'Saved for 24 hours. A reminder is set.'
        : 'Saved for 24 hours. Come back to Spend when you are ready.',
    );
  };

  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="Is it worth your month?"
        subtitle="A little perspective before you check out."
      />

      {!budget && <BudgetSetup />}
      <ActionError
        message={
          error
            ? 'Your saved records could not be loaded, so the budget estimate is unavailable.'
            : null
        }
        onRetry={retry}
      />

      <Rise>
        <FormSection title="What caught your eye?">
          <Field
            label="Item"
            placeholder="Wireless earbuds, shoes, a game…"
            value={item}
            onChangeText={setItem}
            maxLength={100}
          />
          <Field
            label="Price"
            placeholder="₱ 0"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
            error={price && !priceC ? 'Enter a price greater than zero.' : undefined}
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
            error={alt && altC === null ? 'Enter a valid amount or leave this blank.' : undefined}
          />
        </FormSection>
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
                <Icon name="alert" size={20} color={colors.spend} />
                <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                  Your repayments would be about {formatPHP(result.shortfall)} short.
                </Text>
              </Row>
            )}
            {altC && altC < priceC && (
              <Row
                style={{
                  alignItems: 'flex-start',
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <Icon name="leaf" size={20} color={colors.success} />
                <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                  The cheaper option keeps {formatPHP(priceC - altC)} in your pocket.
                </Text>
              </Row>
            )}
          </Card>
        </Rise>
      )}

      <FormSection title="Paying over time?">
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
                    : 'No extra cost in the amounts you entered. Check the agreement for other fees.'}
                </Text>
              </View>
            ) : (
              <Text variant="caption">Enter the price above, then each payment and how many.</Text>
            )}
          </>
        )}
      </FormSection>

      <ActionError message={action.error} />

      <Button
        label="Pause before I decide"
        icon="arrow-forward"
        disabled={!ready}
        loading={action.pending}
        onPress={() => void action.run(checkout)}
      />
      <Button
        label="Save for 24 hours instead"
        kind="outline"
        disabled={!ready || action.pending}
        onPress={() => void action.run(saveForLater)}
      />
      <Text variant="caption">
        Your choice stays yours. Estimates use only the budget and records you have entered.
      </Text>
    </FlowScreen>
  );
}
