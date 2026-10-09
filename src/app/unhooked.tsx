import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { ActionError, FlowScreen } from '@/components/FlowLayout';
import { Ginto } from '@/components/mascot/Ginto';
import { Button, Field, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { emptyOverview, getOverview } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { formatPHP } from '@/domain/money';
import { useAsyncAction } from '@/hooks/useAsyncAction';

type Outcome = 'saved' | 'cheaper' | 'review' | 'plan';
const PLAN_MESSAGE = 'Hello. I want to keep paying my loan, but I cannot pay the full amount on the due date. Can we agree on a payment arrangement with smaller amounts? Thank you.';

export default function UnhookedScreen() {
  const params = useLocalSearchParams<{ outcome?: string; item?: string; amount?: string }>();
  const outcome = (['saved', 'cheaper', 'review', 'plan'].includes(params.outcome ?? '') ? params.outcome : 'saved') as Outcome;
  const { data: overview, loaded, error } = useDbQuery(getOverview, emptyOverview);
  const [message, setMessage] = useState(PLAN_MESSAGE);
  const action = useAsyncAction('Sharing is unavailable right now. You can select and copy the message above.');
  const item = params.item || 'Your purchase';
  const amount = Number(params.amount);
  const copy: Record<Outcome, { title: string; body: string }> = {
    saved: { title: 'A little distance. A clearer decision.', body: `${item} is saved for 24 hours. Find it in Spend when you are ready to look again.` },
    cheaper: { title: 'You have room to reconsider.', body: 'Take your time comparing options. You can run a new purchase check when you find one that feels right.' },
    review: { title: 'Start with what is already due.', body: `${amount > 0 && Number.isFinite(amount) ? `${formatPHP(amount)} can wait. ` : ''}Your current repayments are a good place to begin.` },
    plan: { title: 'Ask for a little breathing room.', body: 'Here is a starting point for a payment-plan request. Edit it so it sounds like you, then choose where to share it.' },
  };
  const toDebt = outcome === 'review' || outcome === 'plan';
  return (
    <FlowScreen>
      <TopBar icon="close" onPress={() => router.dismissTo('/')} />
      <View style={{ alignItems: 'flex-start', gap: spacing.lg, paddingVertical: spacing.xl }}>
        <Ginto mood="proud" size={132} />
        <Text variant="eyebrow" color={colors.lagoon}>A choice made with intention</Text>
        <Text variant="title">{copy[outcome].title}</Text>
        <Text>{copy[outcome].body}</Text>
      </View>
      {outcome === 'plan' && <Field label="Your message" value={message} onChangeText={setMessage} multiline style={{ minHeight: 150, textAlignVertical: 'top' }} />}
      {loaded && !error && overview.dodgedToday > 0 && <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}><Text variant="small">{overview.dodgedToday} {overview.dodgedToday === 1 ? 'pause' : 'pauses'} today led to waiting, reconsidering or taking a break.</Text></View>}
      <ActionError message={action.error} />
      {outcome === 'plan' && <Button label="Share my message" icon="share" loading={action.pending} disabled={!message.trim()} onPress={() => void action.run(() => Share.share({ message: message.trim() }))} />}
      <Button label={toDebt ? 'See what I owe' : 'Go to my purchases'} kind={outcome === 'plan' ? 'outline' : 'ink'} onPress={() => router.dismissTo(toDebt ? '/debt' : '/spend')} />
      <Button label="Back to Today" kind="ghost" onPress={() => router.dismissTo('/')} />
    </FlowScreen>
  );
}
