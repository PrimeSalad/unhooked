import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/Icon';
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  Group,
  GroupRow,
  LargeTitle,
  ProgressBar,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { addEvidence, addPayment, deleteDebt, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { getMonthlyPosition } from '@/domain/monthlyPosition';
import type { DebtBalance } from '@/domain/repayment';
import { dueLabel, isUrgent } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

function PaymentSheet({ target, onClose }: { target: DebtBalance | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);
  const value = parsePesoInput(amount);
  if (!target) return null;
  const lent = target.debt.direction === 'lent';
  const invalid =
    amount.length > 0 && (!value || !Number.isSafeInteger(value) || value > target.outstanding);

  const save = async (c: number) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await addPayment(db, target.debt.id, Math.min(c, target.outstanding));
      showToast(
        c >= target.outstanding ? `${target.debt.counterparty} is settled.` : 'Payment recorded.',
      );
      onClose();
    } catch {
      setError('That payment could not be saved. Your amount is still here. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await deleteDebt(db, target.debt.id);
      showToast('Debt and its payments deleted.');
      onClose();
    } catch {
      setError('This record could not be deleted. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <Sheet open onClose={() => !pending && onClose()}>
      <Text variant="eyebrow">
        {confirmDelete ? 'Delete record' : lent ? 'Payment received' : 'Record a repayment'}
      </Text>
      <Text variant="title">{target.debt.counterparty}</Text>
      {confirmDelete ? (
        <>
          <Text>Delete this debt and its payment history? This cannot be undone.</Text>
          <Button
            label="Delete debt and payments"
            loading={pending}
            onPress={() => void remove()}
          />
          <Button
            label="Keep this record"
            kind="outline"
            disabled={pending}
            onPress={() => setConfirmDelete(false)}
          />
        </>
      ) : (
        <>
          <View style={styles.sheetBalance}>
            <Text variant="caption">
              {target.outstanding ? 'Remaining balance' : 'All settled'}
            </Text>
            <Text variant="number">{formatPHP(target.outstanding)}</Text>
            <Text variant="caption">{dueLabel(target.debt.dueDate)}</Text>
          </View>
          {target.outstanding > 0 && (
            <>
              <Field
                label={lent ? 'Amount received' : 'Amount paid'}
                placeholder="₱ 0.00"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
                error={
                  invalid
                    ? `Enter an amount between ₱0.01 and ${formatPHP(target.outstanding)}.`
                    : undefined
                }
              />
              <Button
                label="Save payment"
                loading={pending}
                disabled={!value || invalid}
                onPress={() => value && void save(value)}
              />
              <Button
                label={`Settle remaining ${formatPHP(target.outstanding)}`}
                kind="outline"
                disabled={pending}
                onPress={() => void save(target.outstanding)}
              />
            </>
          )}
          <Button
            label="Delete this record"
            kind="ghost"
            size="sm"
            icon="trash"
            disabled={pending}
            onPress={() => setConfirmDelete(true)}
          />
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger} variant="small">
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

export default function DebtScreen() {
  const db = useSQLiteContext();
  const budget = useSettings((s) => s.budget);
  const showToast = useSession((s) => s.showToast);
  const { data: o, loaded, error, retry } = useDbQuery(getOverview, emptyOverview);
  const [tab, setTab] = useState<'owed' | 'lent'>('owed');
  const [paying, setPaying] = useState<DebtBalance | null>(null);
  const [imagePending, setImagePending] = useState(false);
  const [imageError, setImageError] = useState('');
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const mine = o.debts.filter((b) => b.debt.direction === tab);
  const open = mine
    .filter((b) => b.outstanding > 0)
    .sort((a, b) => (a.debt.dueDate ?? '9').localeCompare(b.debt.dueDate ?? '9'));
  const settled = mine.filter((b) => b.outstanding === 0);
  const principal = mine.reduce((s, b) => s + b.debt.principal, 0);
  const paid = mine.reduce((s, b) => s + b.paid, 0);
  const owedTab = tab === 'owed';
  const position = getMonthlyPosition({
    budget,
    repayments: o.dueThisMonth,
    spent: o.spentThisMonth,
  });
  const nextPayment = owedTab ? open[0] : null;
  const planCopy =
    position.band === 'missing'
      ? 'Add your monthly budget to see how repayments fit alongside everyday spending.'
      : position.band === 'short'
        ? `${formatPHP(position.repaymentGap)} of this month’s repayments still needs covering.`
        : `${formatPHP(position.safeToSpend)} remains after essentials, recorded spending and repayments.`;

  const addScreenshot = async () => {
    if (imagePending) return;
    setImagePending(true);
    setImageError('');
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (res.canceled || !res.assets[0]) return;
      await addEvidence(db, {
        lender: o.nextDue?.debt.counterparty ?? 'Unsorted',
        imageUri: res.assets[0].uri,
      });
      showToast('Screenshot saved to your private Evidence Pack.');
    } catch {
      setImageError('The screenshot could not be saved. Please select it again.');
    } finally {
      setImagePending(false);
    }
  };
  const row = (b: DebtBalance) => (
    <GroupRow
      key={b.debt.id}
      leading={<Avatar label={b.debt.counterparty} bg={colors.surfaceMuted} fg={colors.text} />}
      title={b.debt.counterparty}
      subtitle={
        b.outstanding === 0
          ? `${formatPHP(b.paid)} repaid · settled`
          : `${dueLabel(b.debt.dueDate)} · ${Math.round(b.progress * 100)}% paid`
      }
      value={formatPHP(b.outstanding)}
      valueTone={
        owedTab && b.outstanding > 0 && isUrgent(b.debt.dueDate) ? colors.spend : undefined
      }
      onPress={() => setPaying(b)}
    />
  );

  return (
    <Screen>
      <LargeTitle eyebrow="A little clarity goes a long way" title="One balance at a time." />
      <Text color={colors.textSoft}>
        Keep track of what you owe, what comes next, and what comes back to you.
      </Text>
      <View style={[styles.toolbar, wide && styles.toolbarWide]}>
        <View style={{ flex: 1, maxWidth: wide ? 420 : undefined }}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'owed', label: 'I owe' },
              { value: 'lent', label: 'Owed to me' },
            ]}
          />
        </View>
        {mine.length > 0 && (
          <Button
            label={owedTab ? 'Add a debt' : 'Add money lent'}
            icon="add"
            size="sm"
            onPress={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
          />
        )}
      </View>
      {error ? (
        <View style={styles.feedback}>
          <Text color={colors.danger}>Your balances could not be refreshed.</Text>
          <Button label="Try again" kind="outline" onPress={retry} />
        </View>
      ) : null}
      {!loaded ? (
        <ActivityIndicator
          color={colors.text}
          accessibilityLabel="Loading your balances"
          style={styles.loading}
        />
      ) : (
        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={{ flex: wide ? 1.65 : undefined, minWidth: 0, gap: spacing.xxl }}>
            {mine.length === 0 ? (
              <EmptyState
                mood="calm"
                title={owedTab ? 'Start with one balance.' : 'Keep the little loans clear.'}
                body={
                  owedTab
                    ? 'Add a loan, a pay-later plan, or money borrowed from someone you know. Your next step will be easier to see.'
                    : 'Record money you lent to a friend or family member, then mark payments as they come back.'
                }
                action={owedTab ? 'Add my first debt' : 'Add money I lent'}
                onAction={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
              />
            ) : (
              <>
                <View style={styles.summary}>
                  <Text variant="eyebrow" color={colors.pauseMuted}>
                    {owedTab ? 'Your remaining balance' : 'Still coming back to you'}
                  </Text>
                  <Text variant="display" color={colors.white} style={styles.balance}>
                    {formatPHP(owedTab ? o.owedTotal : o.lentTotal)}
                  </Text>
                  <ProgressBar
                    value={principal ? paid / principal : 0}
                    color={colors.primary}
                    track="rgba(255,255,255,0.18)"
                  />
                  <Text variant="small" color={colors.pauseMuted}>
                    {formatPHP(paid)} of {formatPHP(principal)} {owedTab ? 'repaid' : 'returned'}
                  </Text>
                  <View style={styles.planStats}>
                    <View style={styles.stat}>
                      <Text variant="heading" color={colors.white}>
                        {owedTab ? formatPHP(o.dueThisMonth) : String(settled.length)}
                      </Text>
                      <Text variant="caption" color={colors.pauseMuted}>
                        {owedTab ? 'due this month' : 'settled records'}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text variant="heading" color={colors.white}>
                        {open.length}
                      </Text>
                      <Text variant="caption" color={colors.pauseMuted}>
                        {open.length === 1 ? 'open balance' : 'open balances'}
                      </Text>
                    </View>
                  </View>
                </View>
                {owedTab && nextPayment ? (
                  <Section title="Your next repayment">
                    <Group>
                      <GroupRow
                        icon="calendar"
                        title={nextPayment.debt.counterparty}
                        subtitle={dueLabel(nextPayment.debt.dueDate)}
                        value={formatPHP(nextPayment.outstanding)}
                        onPress={() => setPaying(nextPayment)}
                      />
                    </Group>
                    <Button
                      label="Record a payment"
                      icon="check"
                      onPress={() => setPaying(nextPayment)}
                    />
                  </Section>
                ) : null}
                {open.length > 0 && (
                  <Section title={owedTab ? 'Open balances' : 'Waiting on'}>
                    <Group>{open.map(row)}</Group>
                  </Section>
                )}
                {settled.length > 0 && (
                  <Section title="Settled & done">
                    <Group>{settled.map(row)}</Group>
                  </Section>
                )}
              </>
            )}
          </View>
          <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: spacing.xxl }}>
            {owedTab && mine.length > 0 && (
              <View style={styles.monthNote}>
                <Icon name="wallet" color={colors.text} size={26} />
                <Text variant="heading">Make room for this month.</Text>
                <Text variant="small">{planCopy}</Text>
                <Button
                  label={budget ? 'Review my budget' : 'Set my monthly budget'}
                  kind="outline"
                  size="sm"
                  onPress={() => router.push('/settings')}
                />
              </View>
            )}
            <Section title="A little backup">
              <Group>
                <GroupRow
                  icon="shield"
                  title="Check a collector’s message"
                  subtitle="Understand warning signs before responding"
                  onPress={() => router.push('/message-check')}
                />
                <GroupRow
                  icon="hand"
                  title="Before you borrow"
                  subtitle="See how another loan would fit"
                  onPress={() => router.push('/borrow')}
                />
                <GroupRow
                  icon="chat"
                  title="Talk it through with Ginto"
                  subtitle="Based on your own records"
                  onPress={() => router.push('/chat')}
                />
              </Group>
            </Section>
            <View style={styles.evidence}>
              <Icon name="images" color={colors.text} size={24} />
              <Text variant="heading">Your Evidence Pack</Text>
              <Text variant="small">
                {o.evidence.count
                  ? `${o.evidence.count} saved screenshots from ${o.evidence.lenders} ${o.evidence.lenders === 1 ? 'lender' : 'lenders'}.`
                  : 'Save threatening messages and screenshots in one private place on this device.'}
              </Text>
              <Button
                label="Save a screenshot"
                icon="image"
                kind="outline"
                size="sm"
                loading={imagePending}
                onPress={() => void addScreenshot()}
              />
              {imageError ? (
                <Text variant="small" accessibilityRole="alert" color={colors.danger}>
                  {imageError}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}
      <PaymentSheet
        key={paying?.debt.id ?? 'none'}
        target={paying}
        onClose={() => setPaying(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.md },
  toolbarWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  columns: { gap: spacing.xxl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  summary: {
    backgroundColor: colors.text,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  balance: { fontSize: 42, lineHeight: 54, letterSpacing: -1.5 },
  planStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: spacing.lg,
    marginTop: spacing.sm,
  },
  stat: { flex: 1, minWidth: 100, gap: spacing.xs },
  monthNote: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.md,
  },
  evidence: {
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  sheetBalance: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  feedback: { gap: spacing.md, paddingVertical: spacing.md },
  loading: { padding: spacing.xxxl },
});
