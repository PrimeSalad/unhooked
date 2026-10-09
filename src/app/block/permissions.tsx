// Prominent disclosure before each Android permission (Play policy): what, why, stays on device.

import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import {
  canDrawOverlays,
  hasUsageAccess,
  openOverlaySettings,
  openUsageAccessSettings,
} from '../../../modules/unhooked-guard';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Card, Screen, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { syncGuard } from '@/lib/guard';

function Step({
  done,
  title,
  why,
  onAllow,
}: {
  done: boolean;
  title: string;
  why: string;
  onAllow: () => void;
}) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={done ? 'check-circle' : 'circle'}
          size={22}
          color={done ? colors.success : colors.textFaint}
        />
        <Text variant="strong" style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text variant="small">{why}</Text>
      {!done && <Button label="Allow" size="sm" onPress={onAllow} />}
    </Card>
  );
}

export default function GuardPermissionsScreen() {
  const db = useSQLiteContext();
  const [usage, setUsage] = useState(hasUsageAccess());
  const [overlay, setOverlay] = useState(canDrawOverlays());

  // Re-check when the user comes back from system Settings.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      setUsage(hasUsageAccess());
      setOverlay(canDrawOverlays());
    });
    return () => sub.remove();
  }, []);

  const finish = async () => {
    await syncGuard(await listRules(db));
    router.dismissTo('/scroll');
  };

  return (
    <Screen tabs={false}>
      <TopBar />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Ginto mood="brave" size={130} />
        <Text variant="title" align="center">
          Two switches, then I can help
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          Both are Android settings you control. What you open stays on this phone. Nothing is sent
          anywhere.
        </Text>
      </View>
      <Step
        done={usage}
        title="Usage access"
        why="Lets Unhooked notice when an app you guarded comes to the front. It does not read what you do inside apps."
        onAllow={openUsageAccessSettings}
      />
      <Step
        done={overlay}
        title="Display over other apps"
        why="Lets the pause appear on top of a guarded app, so you get ten seconds to decide."
        onAllow={openOverlaySettings}
      />
      <Button
        label={usage && overlay ? 'Turn on guards' : 'Done for now'}
        kind="ink"
        onPress={() => void finish()}
      />
      {!(usage && overlay) && (
        <Text variant="caption" align="center">
          Not now is fine. The rest of Unhooked keeps working.
        </Text>
      )}
    </Screen>
  );
}
