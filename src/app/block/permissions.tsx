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

import { Button, Text, ScreenHeader } from '@/components/ui';
import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { colors, spacing } from '@/constants/theme';
import { listRules } from '@/db/blockRules';
import { isGuardAvailable, syncGuard } from '@/lib/guard';
import { useAsyncAction } from '@/hooks/useAsyncAction';

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
    <FormSection title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={done ? 'check-circle' : 'circle'}
          size={22}
          color={done ? colors.success : colors.textFaint}
        />
        <Text variant="strong" style={{ flex: 1 }}>
          {done ? 'Permission enabled' : 'Permission needed'}
        </Text>
      </View>
      <Text variant="small">{why}</Text>
      {!done && <Button label={`Enable ${title.toLowerCase()}`} size="sm" onPress={onAllow} />}
    </FormSection>
  );
}

export default function GuardPermissionsScreen() {
  const db = useSQLiteContext();
  const action = useAsyncAction(
    'Could not enable your guards. Check the permissions and try again.',
  );
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

  if (!isGuardAvailable())
    return (
      <FlowScreen>
        <ScreenHeader
          back
          title="Guards need the Android build."
          subtitle="App permissions are not available on this platform."
        />
        <Text>
          You can still track sessions, take a pause and prepare your website list. No system
          permission is needed for those features.
        </Text>
        <Button label="Back to Scroll" onPress={() => router.dismissTo('/scroll')} />
      </FlowScreen>
    );

  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="Two permissions. Your choice."
        subtitle="Enable only what you feel comfortable using."
      />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
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
        loading={action.pending}
        onPress={() => void action.run(finish)}
      />
      <ActionError message={action.error} />
      {!(usage && overlay) && (
        <Text variant="caption" align="center">
          Not now is fine. The rest of Unhooked keeps working.
        </Text>
      )}
    </FlowScreen>
  );
}
