import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Avatar,
  Button,
  EmptyState,
  Field,
  Group,
  GroupRow,
  IconButton,
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
import type { DebtBalance } from '@/domain/repayment';
import { dueLabel, isUrgent } from '@/lib/format';
import { useSession } from '@/store/session';

function PaymentSheet({ target, onClose }: { target: DebtBalance | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [amount, setAmount] = useState('');
  const value = parsePesoInput(amount);
  if (!target) return null;
  const lent = target.debt.direction === 'lent';

  const save = async (c: number) => {
    await addPayment(db, target.debt.id, Math.min(c, target.outstanding));
    onClose();
    showToast(
      c >= target.outstanding
        ? `${target.debt.counterparty} is settled. Well done.`
        : 'Payment recorded.',
    );
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
      <Button label="Save payment" disabled={!value} onPress={() => value && void save(value)} />
      <Button
        label={`Settle all ${formatPHP(target.outstanding)}`}
        kind="outline"
        onPress={() => void save(target.outstanding)}
      />
      <Button
        label="Delete this record"
        kind="ghost"
        size="sm"
        icon="trash-outline"
        onPress={async () => {
          await deleteDebt(db, target.debt.id);
          onClose();
          showToast('Record deleted.');
        }}
      />
    </Sheet>
  );
}

export default function DebtScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
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

  const addScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    await addEvidence(db, {
      lender: o.nextDue?.debt.counterparty ?? 'Unsorted',
      imageUri: res.assets[0].uri,
    });
    showToast('Saved to your private Evidence Pack.');
  };

  const row = (b: DebtBalance) => (
    <GroupRow
      key={b.debt.id}
      leading={
        <Avatar
          label={b.debt.counterparty}
          bg={owedTab ? colors.debtSoft : '#E5F2EA'}
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
      <LargeTitle
        eyebrow="What you owe, and what you are owed"
        title="Debt"
        right={
          <IconButton
            icon="add"
            label="Add a debt"
            tone={colors.text}
            color={colors.bg}
            onPress={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
          />
        }
      />

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
          <View
            style={[styles.summary, { backgroundColor: owedTab ? colors.debt : colors.success }]}
          >
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
        </>
      )}

      <Section title="Safety">
        <Group>
          <GroupRow
            icon="images-outline"
            iconBg={colors.text}
            iconFg={colors.accent}
            title="Evidence Pack"
            subtitle={
              o.evidence.count
                ? `${o.evidence.count} saved · ${o.evidence.lenders} ${o.evidence.lenders === 1 ? 'lender' : 'lenders'} · private`
                : 'Keep threatening messages and screenshots safe'
            }
            trailing={
              <IconButton
                icon="add"
                label="Add a screenshot"
                tone={colors.track}
                onPress={() => void addScreenshot()}
              />
            }
          />
          <GroupRow
            icon="shield-checkmark-outline"
            title="Scan a message"
            subtitle="Check a collector's text for warning signs"
            onPress={() => router.push('/message-check')}
          />
          <GroupRow
            icon="hand-left-outline"
            title="Thinking of borrowing?"
            subtitle="Pause with me before you sign"
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
