// Local notifications for scroll limits and the 24-hour cooling period.
// Native only; every call fails quietly so the in-app flow never depends on them.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function allowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Discreet wording on purpose: lock screens are public (plan.md → Target users). */
export async function remindIn(
  seconds: number,
  title: string,
  body: string,
): Promise<string | null> {
  if (!(await allowed())) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string | null | undefined) {
  if (!id || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or never scheduled
  }
}
