// Keeps the native call screening service in step with the number log, saves calls it flagged
// while the app was closed, and opens Scan a message for text shared from another app.
// Renders nothing; mounted once inside the database provider.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { saveScreenedCalls } from '@/db/collectorCalls';
import { logEvent } from '@/db/events';
import { listNumberReports } from '@/db/numberReports';
import { useDbQuery } from '@/db/useDbQuery';
import { parseScreenedCalls, screenList } from '@/domain/callScreen';
import { summarizeNumbers } from '@/domain/numberLog';
import { useSettings } from '@/store/settings';

import {
  addSharedTextListener,
  configureCallScreening,
  hasCallScreeningRole,
  takeScreenedCalls,
  takeSharedText,
} from '../../modules/unhooked-guard';

export function CollectorCallBridge() {
  const db = useSQLiteContext();
  const { data: reports } = useDbQuery(listNumberReports, []);
  const mode = useSettings((s) => s.callScreenMode);
  const blocked = useSettings((s) => s.blockedNumbers);
  // Bumped when the app returns to the front, e.g. after Android's screening-role dialog.
  const [foreground, setForeground] = useState(0);

  // The service reads this copy, so screening works while the app is closed.
  useEffect(() => {
    configureCallScreening(
      screenList(summarizeNumbers(reports), blocked),
      hasCallScreeningRole() ? mode : 'off',
    );
  }, [reports, mode, blocked, foreground]);

  useEffect(() => {
    const drain = () => {
      const calls = parseScreenedCalls(takeScreenedCalls());
      if (calls.length) void saveScreenedCalls(db, calls);
    };
    const openShared = (text: string | null) => {
      if (!text) return;
      void logEvent(db, 'message_shared', { length: text.length });
      router.push({ pathname: '/message-check', params: { text } });
    };
    drain();
    openShared(takeSharedText());
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      drain();
      setForeground((n) => n + 1);
    });
    const shared = addSharedTextListener(openShared);
    return () => {
      app.remove();
      shared.remove();
    };
  }, [db]);

  return null;
}
