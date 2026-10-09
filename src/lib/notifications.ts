// Local notifications for scroll limits and the 24-hour cooling period.
// Native only; every call fails quietly so the in-app flow never depends on them.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { repaymentReminderDate } from '@/domain/repayment';

const REMINDER_CHANNEL = 'gentle-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Ask only after the in-app disclosure. Returns whether reminders can be scheduled. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      // Android 13 does not show its notification permission prompt until a channel exists.
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
        name: 'Gentle reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
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
  if (!(await requestReminderPermission())) return null;
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

/** A stable identifier lets payments, deletion and a full reset cancel this reminder. */
export const debtReminderId = (debtId: string) => `debt-due-${debtId}`;
export const coolingReminderId = (purchaseId: string) => `cooling-${purchaseId}`;

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // Records still clear even if the notification service is unavailable.
  }
}

export async function scheduleDebtReminder(debtId: string, dueDate: string): Promise<boolean> {
  const date = repaymentReminderDate(dueDate);
  if (!date || !(await requestReminderPermission())) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: debtReminderId(debtId),
      content: {
        title: 'Upcoming date',
        body: 'A date you saved is coming up. Open Unhooked to review it.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: Platform.OS === 'android' ? REMINDER_CHANNEL : undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleCoolingReminder(
  purchaseId: string,
  untilIso: string,
): Promise<boolean> {
  const date = new Date(untilIso);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now() || !(await requestReminderPermission()))
    return false;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: coolingReminderId(purchaseId),
      content: {
        title: 'Ready to decide?',
        body: 'Something you saved is ready for another look in Unhooked.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: Platform.OS === 'android' ? REMINDER_CHANNEL : undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
}
