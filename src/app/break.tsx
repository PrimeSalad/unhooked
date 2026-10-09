import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Card, Rise, Row, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { logBreak } from '@/db/repo';
import { pickBreakIdea } from '@/domain/scroll';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

export default function BreakScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const lastBreakIdea = useSettings((s) => s.lastBreakIdea);
  const setLastBreakIdea = useSettings((s) => s.setLastBreakIdea);
  const [idea] = useState(() => pickBreakIdea(lastBreakIdea));
  const [left, setLeft] = useState(120);

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <TopBar icon="close" onPress={() => router.dismissTo('/')} />
      <View style={{ alignItems: 'center' }}>
        <Ginto mood="wave" size={200} />
      </View>
      <Rise style={{ gap: spacing.md, flex: 1 }}>
        <Text variant="eyebrow" color={colors.lagoon}>
          Break · {mm}:{ss}
        </Text>
        <Text variant="title" style={{ fontSize: 30 }}>
          {idea.title}
        </Text>
        {idea.steps.map((step, i) => (
          <Card key={step} style={{ paddingVertical: spacing.md }}>
            <Row>
              <View style={styles.num}>
                <Text variant="strong" color={colors.lagoon}>
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14 }}>{step}</Text>
            </Row>
          </Card>
        ))}
      </Rise>
      <Button
        label="Done, back to Today"
        kind="ink"
        onPress={async () => {
          await logBreak(db);
          setLastBreakIdea(idea.id);
          router.dismissTo('/');
          showToast('Break logged. Your feed will still be there.');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.shell, paddingHorizontal: spacing.xl, gap: spacing.lg },
  num: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.scrollSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
