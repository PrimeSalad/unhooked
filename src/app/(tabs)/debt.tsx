import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  ProgressBar,
  Rise,
  Row,
  Screen,
  ScreenHeader,
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

function DebtCard({ b, onPress }: { b: DebtBalance; onPress: () => void }) {
  const lent = b.debt.direction === 'lent';
  const urgent = !lent && isUrgent(b.debt.dueDate);
  return (
    <Card style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="strong">{b.debt.counterparty}</Text>
          <Text variant="caption">{b.debt.notes || (lent ? 'You lent this' : 'You owe this')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="heading">{formatPHP(b.outstanding)}</Text>
          <Text variant="caption" color={urgent ? colors.spend : colors.textMuted}>
            {b.outstanding === 0 ? 'Fully paid' : dueLabel(b.debt.dueDate)}
          </Text>
        </View>
      </Row>
      <ProgressBar
        value={b.progress}
        color={lent ? colors.success : urgent ? colors.primarySoft : colors.accent}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color={colors.textSoft}>
          {formatPHP(b.paid)} of {formatPHP(b.debt.principal)} {lent ? 'paid back' : 'paid'}
        </Text>
        {b.outstanding > 0 && (
          <Button
            label={lent ? 'Got paid' : 'Record payment'}
            kind="outline"
            size="sm"
            onPress={onPress}
            style={{ minHeight: 36, paddingHorizontal: spacing.md }}
          />
        )}
      </Row>
    </Card>
  );
}

function PaymentSheet({ target, onClose }: { target: DebtBalance | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const [amount, setAmount] = useState('');
  const value = parsePesoInput(amount);
  if (!target) return null;
  const lent = target.debt.direction === 'lent';

  const save = async (c: number) => {
    await addPayment(db, target.debt.id, Math.min(c, target.outstanding));
    setAmount('');
    onClose();
    showToast(
      c >= target.outstanding
        ? `${target.debt.counterparty} is fully settled. Well done.`
        : 'Payment recorded.',
    );
  };

  return (
    <Sheet open onClose={onClose} mascot={lent ? 'happy' : 'proud'}>
      <Text variant="heading" align="center">
        {lent ? `${target.debt.counterparty} paid you back?` : `Paying ${target.debt.counterparty}`}
      </Text>
      <Text variant="small" align="center" color={colors.textMuted}>
        {formatPHP(target.outstanding)} still open
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

  const list = o.debts
    .filter((b) => b.debt.direction === tab)
    .sort(
      (a, b) =>
        (a.outstanding === 0 ? 1 : 0) - (b.outstanding === 0 ? 1 : 0) ||
        (a.debt.dueDate ?? '9').localeCompare(b.debt.dueDate ?? '9'),
    );

  const addScreenshot = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    await addEvidence(db, {
      lender: o.nextDue?.debt.counterparty ?? 'Unsorted',
      imageUri: res.assets[0].uri,
    });
    showToast('Screenshot saved to your private Evidence Pack.');
  };

  return (
    <Screen>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <ScreenHeader title="Debt" subtitle="What you owe, and what you are owed." />
        </View>
        <IconButton
          icon="add"
          label="Add a debt"
          tone={colors.text}
          color={colors.bg}
          onPress={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
        />
      </Row>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'owed', label: 'I owe' },
          { value: 'lent', label: 'Owed to me' },
        ]}
      />

      {loaded && list.length === 0 ? (
        <EmptyState
          mood={tab === 'owed' ? 'happy' : 'thinking'}
          title={tab === 'owed' ? 'Nothing owed. Nice.' : 'Nobody owes you yet'}
          body={
            tab === 'owed'
              ? 'Add loans, online lending apps or pay-later plans so I can warn you before due dates pile up.'
              : 'Lent money to a friend or family? Keep track here instead of in your head.'
          }
          action={tab === 'owed' ? 'Add what I owe' : 'Add money I lent'}
          onAction={() => router.push({ pathname: '/debt-new', params: { direction: tab } })}
        />
      ) : (
        <>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
            <Text variant="small" color={colors.textMuted}>
              {tab === 'owed'
                ? `Left to pay · ${formatPHP(o.dueThisMonth)} due this month`
                : 'Owed to you'}
            </Text>
            <Text variant="heading" style={{ fontSize: 22 }}>
              {formatPHP(tab === 'owed' ? o.owedTotal : o.lentTotal)}
            </Text>
          </Row>
          <View key={tab} style={{ gap: spacing.md }}>
            {list.map((b, i) => (
              <Rise key={b.debt.id} delay={i * 50}>
                <DebtCard b={b} onPress={() => setPaying(b)} />
              </Rise>
            ))}
          </View>
        </>
      )}

      <View
        style={{
          backgroundColor: colors.text,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.lg,
        }}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" color={colors.bg}>
              Evidence Pack
            </Text>
            <Text variant="caption" color="#D9BFA8">
              {o.evidence.count === 0
                ? 'Save threatening messages and screenshots here. Private, on this phone.'
                : `${o.evidence.count} saved · ${o.evidence.lenders} ${o.evidence.lenders === 1 ? 'lender' : 'lenders'} · stays on this phone`}
            </Text>
          </View>
          <Ionicons name="document-lock-outline" size={28} color={colors.accent} />
        </Row>
        <Row gap={10}>
          <Button
            label="Screenshot"
            icon="image-outline"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => void addScreenshot()}
          />
          <Button
            label="Scan message"
            size="sm"
            kind="outlineLight"
            style={{ flex: 1 }}
            onPress={() => router.push('/message-check')}
          />
        </Row>
      </View>

      <Button
        label="I am thinking of borrowing"
        kind="outline"
        onPress={() => router.push('/borrow')}
      />

      <PaymentSheet target={paying} onClose={() => setPaying(null)} />
    </Screen>
  );
}
