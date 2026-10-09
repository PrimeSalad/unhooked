import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { Ginto } from '@/components/mascot/Ginto';
import { Button, Row, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { logBreak } from '@/db/repo';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useSession } from '@/store/session';

const STEPS = ['Let your shoulders drop. Roll them back slowly.', 'Look away from the screen, toward something farther away.', 'Take a sip of water. Let the next thing wait.'];

export default function BreakScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const action = useAsyncAction();
  const [endsAt] = useState(() => Date.now() + 120000);
  const [left, setLeft] = useState(120);
  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return (
    <FlowScreen bg={colors.shell}>
      <TopBar icon="close" onPress={() => router.dismissTo('/')} />
      <View style={{ alignItems: 'center', gap: spacing.lg }}>
        <Ginto mood="calm" size={140} />
        <Text variant="eyebrow">A moment off the hook</Text>
        <Text variant="title" align="center">Nothing needs you right now.</Text>
        <Text variant="number" accessibilityLabel={`${Math.floor(left / 60)} minutes ${left % 60} seconds remaining`} style={{ fontVariant: ['tabular-nums'] }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</Text>
        <Text variant="small" align="center">{left ? 'Take up to two minutes. Finish whenever you are ready.' : 'Your two minutes are yours again.'}</Text>
      </View>
      <FormSection title="Come back to the room.">
        {STEPS.map((step, index) => <Row key={step} style={{ alignItems: 'flex-start', paddingVertical: spacing.sm }}><Text variant="eyebrow" color={colors.lagoon}>{String(index + 1).padStart(2, '0')}</Text><Text style={{ flex: 1 }}>{step}</Text></Row>)}
      </FormSection>
      <ActionError message={action.error} />
      <Button label="I’m ready. Log my break." kind="ink" loading={action.pending} onPress={() => void action.run(async () => { await logBreak(db); router.dismissTo('/'); showToast('Break logged. Welcome back.'); })} />
    </FlowScreen>
  );
}
