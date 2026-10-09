import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Share, StyleSheet, View } from 'react-native';

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
import { addPayment, deleteDebt, emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { politeReminder, type DebtBalance } from '@/domain/repayment';
import { dueLabel, isUrgent } from '@/lib/format';
import { useSession } from '@/store/session';

function PaymentSheet({ target, onClose }: { target: DebtBalance | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const value = parsePesoInput(amount);
  if (!target) return null;
  const lent = target.debt.direction === 'lent';

  const save = async (c: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await addPayment(db, target.debt.id, Math.min(c, target.outstanding));
      onClose();
      showToast(
        c >= target.outstanding
          ? `${target.debt.counterparty} is settled. Well done.`
          : 'Payment recorded.',
      );
    } catch {
      showToast('Could not record the payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} mascot={lent ? 'happy' : 'proud'}>
      <Text variant="heading" align="center">
        {lent ? `${target.debt.counterparty} paid you back?` : `Paying ${target.debt.counterparty}`}
      </Text>
      <Text variant="small" align="center" color={colors.textMuted}>
        {formatPHP(target.outstanding)} still open · {dueLabel(target.debt.dueDate)}
      </Text>
      <Field
        label="Amount"
        placeholder="₱ 0"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
      />
      <Button
        label="Save payment"
        disabled={!value || busy}
        onPress={() => value && void save(value)}
      />
      <Button
        label={`Settle all ${formatPHP(target.outstanding)}`}
        kind="outline"
        disabled={busy}
        onPress={() => void save(target.outstanding)}
      />
      {lent ? (
        <Button
          label="Draft a polite reminder"
          kind="outline"
          onPress={() => {
            void Share.share({
              message: politeReminder(target.debt.counterparty, target.outstanding),
            }).catch(() => showToast('Could not open sharing on this device.'));
          }}
        />
      ) : null}
      <Button
        label="Delete this record"
        kind="ghost"
        size="sm"
        icon="trash"
        onPress={() => {
          const remove = () => {
            void deleteDebt(db, target.debt.id)
              .then(() => {
                onClose();
                showToast('Record deleted.');
              })
              .catch(() => showToast('Could not delete this record.'));
          };
          if (Platform.OS === 'web') {
            if (globalThis.confirm?.('Delete this debt and its payment history?')) remove();
            return;
          }
          Alert.alert('Delete this record?', 'Its payment history will also be removed.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: remove },
          ]);
        }}
      />
    </Sheet>
  );
}

export default function DebtScreen() {
  const { data: o, loaded } = useDbQuery(getOverview, emptyOverview);
  const [tab, setTab] = useState<'owed' | 'lent'>('owed');
  const [paying, setPaying] = useState<DebtBalance | null>(null);

  const mine = o.debts.filter((b) => b.debt.direction === tab);
  const open = mine
    .filter((b) => b.outstanding > 0)
    .sort((a, b) => (a.debt.dueDate ?? '9').localeCompare(b.debt.dueDate ?? '9'));
  const settled = mine.filter((b) => b.outstanding === 0);
  const principal = mine.reduce((s, b) => s + b.debt.principal, 0);
  const paid = mine.reduce((s, b) => s + b.paid, 0);
  const owedTab = tab === 'owed';

  const row = (b: DebtBalance) => (
    <GroupRow
      key={b.debt.id}
      leading={
        <Avatar
          label={b.debt.counterparty}
          bg={owedTab ? colors.debtSoft : '#F3ECE4'}
          fg={owedTab ? colors.debt : colors.success}
        />
      }
      title={b.debt.counterparty}
      subtitle={
        b.outstanding === 0
          ? 'Settled'
          : `${dueLabel(b.debt.dueDate)} · ${Math.round(b.progress * 100)}% paid`
      }
      value={formatPHP(b.outstanding)}
      valueTone={
        owedTab && b.outstanding > 0 && isUrgent(b.debt.dueDate) ? colors.spend : undefined
      }
      onPress={b.outstanding > 0 ? () => setPaying(b) : undefined}
    />
  );

  return (
    <Screen>
      <LargeTitle eyebrow="What you owe, and what you are owed" title="Debt" />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owed', label: 'I owe' },
          { value: 'lent', label: 'Owed to me' },
        ]}
      />

      {loaded && mine.length === 0 ? (
        <EmptyState
          mood={owedTab ? 'happy' : 'thinking'}
          title={owedTab ? 'Nothing owed. Nice.' : 'Nobody owes you yet'}
          body={
            owedTab
              ? 'Add loans, lending apps or pay-later plans so I can warn you before due dates pile up.'
              : 'Lent money to a friend or family? Keep track here instead of in your head.'
          }
          action={owedTab ? 'Add what I owe' : 'Add money I lent'}
          onAction={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
        />
      ) : (
        <>
          <View style={[styles.summary, { backgroundColor: colors.text }]}>
            <Text variant="eyebrow" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
              {owedTab ? 'Left to pay' : 'Owed to you'}
            </Text>
            <Text variant="display" color={colors.white} style={{ fontSize: 40, lineHeight: 46 }}>
              {formatPHP(owedTab ? o.owedTotal : o.lentTotal)}
            </Text>
            <ProgressBar
              value={principal ? paid / principal : 0}
              color={colors.white}
              track="rgba(255,255,255,0.22)"
            />
            <Text variant="caption" color="rgba(255,255,255,0.85)">
              {formatPHP(paid)} of {formatPHP(principal)} {owedTab ? 'paid' : 'returned'}
              {owedTab && o.dueThisMonth > 0
                ? ` · ${formatPHP(o.dueThisMonth)} due this month`
                : ''}
            </Text>
            {owedTab && o.nextDue ? (
              <Text variant="caption" color="rgba(255,255,255,0.85)">
                Next: {o.nextDue.debt.counterparty} · {dueLabel(o.nextDue.debt.dueDate)}
              </Text>
            ) : null}
          </View>

          {open.length > 0 && (
            <Section title={owedTab ? 'Open' : 'Waiting on'}>
              <Group>{open.map(row)}</Group>
            </Section>
          )}
          {settled.length > 0 && (
            <Section title="Settled">
              <Group>{settled.map(row)}</Group>
            </Section>
          )}
          {owedTab && open.length > 0 ? (
            <Button
              label="Make a repayment plan"
              kind="outline"
              onPress={() => router.push('/repayment-plan')}
            />
          ) : null}
        </>
      )}

      <Section title="Protect yourself">
        <Group>
          <GroupRow
            icon="images"
            title="Evidence Pack"
            subtitle={
              o.evidence.count
                ? `${o.evidence.count} saved from ${o.evidence.lenders} ${o.evidence.lenders === 1 ? 'lender' : 'lenders'}`
                : 'Screenshots and messages, stored only on this phone'
            }
            value={o.evidence.count ? String(o.evidence.count) : undefined}
            onPress={() => router.push('/evidence-pack')}
          />
          <GroupRow
            icon="shield"
            title="Scan a message"
            subtitle="Check a collector's text for threats"
            onPress={() => router.push('/message-check')}
          />
          <GroupRow
            icon="hand"
            title="Before you borrow"
            subtitle="See how another loan fits your month"
            onPress={() => router.push('/borrow')}
          />
        </Group>
      </Section>

      <PaymentSheet
        key={paying?.debt.id ?? 'none'}
        target={paying}
        onClose={() => setPaying(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: radius.xxl, padding: spacing.xl, gap: spacing.sm },
});
