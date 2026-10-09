// Prominent disclosure for permissions needed after onboarding.
// Guard permissions stay on their own screen, asked only when a guard is set up.

import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, Card, Screen, Text, TopBar } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { requestReminderPermission } from '@/lib/notifications';
import { useSettings } from '@/store/settings';

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

export default function PermissionsScreen() {
  const db = useSQLiteContext();
  const setPermissionsReviewed = useSettings((s) => s.setPermissionsReviewed);
  const [microphone, setMicrophone] = useState(false);
  const [reminders, setReminders] = useState(false);

  const refresh = async () => {
    if (Platform.OS !== 'android') return;
    const [micGranted, notificationPermission] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
      Notifications.getPermissionsAsync().catch(() => null),
    ]);
    setMicrophone(micGranted);
    setReminders(notificationPermission?.granted === true);
  };

  useEffect(() => {
    const initialCheck = setTimeout(() => void refresh(), 0);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearTimeout(initialCheck);
      sub.remove();
    };
  }, []);

  const allowMicrophone = async () => {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    setMicrophone(result === PermissionsAndroid.RESULTS.GRANTED);
  };

  const allowReminders = async () => {
    setReminders(await requestReminderPermission());
  };

  const finish = async () => {
    setPermissionsReviewed(true);
    await logEvent(db, 'permissions_reviewed', {
      microphone,
      reminders,
    }).catch(() => undefined);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen tabs={false}>
      <TopBar />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Ginto mood="calm" size={130} />
        <Text variant="title" align="center">
          Two permissions, then you are set
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          Both are optional. Voice is converted to text on this phone, and reminders stay discreet.
          Photo access is asked only when you choose a screenshot.
        </Text>
      </View>
      <Step
        done={microphone}
        title="Microphone"
        why="Lets you speak to Ginto. Android turns the words into text on this phone, and the recording is not saved or uploaded. You can review the text before sending."
        onAllow={() => void allowMicrophone()}
      />
      <Step
        done={reminders}
        title="Gentle reminders"
        why="Lets Unhooked remind you the day before a repayment and when a 24-hour pause ends. Lock-screen text never mentions debt."
        onAllow={() => void allowReminders()}
      />
      <Button
        label={microphone && reminders ? 'Start' : 'Continue'}
        kind="ink"
        onPress={() => void finish()}
      />
      {!(microphone && reminders) && (
        <Text variant="caption" align="center">
          Not now is fine. You can allow these later in Privacy and settings.
        </Text>
      )}
    </Screen>
  );
}
