import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  Chips,
  ProgressBar,
  Rise,
  Row,
  Screen,
  ScreenHeader,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { activeSession, endSession, scrollStats, setSessionOutcome, startSession } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { elapsedSeconds, formatClock, formatMinutes } from '@/domain/scroll';
import { cancelReminder, remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const APPS = ['TikTok', 'Facebook', 'Instagram', 'YouTube', 'X', 'Other'] as const;
const LIMITS = ['10', '20', '30', '45'] as const;

const emptyStats = {
  todayMinutes: 0,
  longestToday: 0,
  weekMinutes: 0,
  weekSessions: 0,
  peakHour: null as number | null,
};

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`;

export default function ScrollScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const defaultLimit = useSettings((s) => s.scrollLimitMinutes);
  const setDefaultLimit = useSettings((s) => s.setScrollLimit);
  const { data: session } = useDbQuery(activeSession, null);
  const { data: stats } = useDbQuery(scrollStats, emptyStats);

  const [app, setApp] = useState<(typeof APPS)[number]>('TikTok');
  const [limit, setLimit] = useState(String(defaultLimit));
  const [now, setNow] = useState(() => new Date());
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [reminderId, setReminderId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [session]);

  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const limitS = session ? session.limitMinutes * 60 : 1;
  const due = !!session && elapsed >= limitS && now.getTime() >= (snoozedUntil[session.id] ?? 0);

  const start = async () => {
    const minutes = Number(limit);
    setDefaultLimit(minutes);
    await startSession(db, app, minutes);
    setNow(new Date());
    setReminderId(
      await remindIn(
        minutes * 60,
        'Quick check-in',
        `${minutes} minutes are up. Still scrolling on purpose?`,
      ),
    );
  };

  const finish = async (msg?: string) => {
    if (!session) return;
    await endSession(db, session.id);
    await cancelReminder(reminderId);
    if (msg) showToast(msg);
  };

  const takeBreak = async () => {
    if (!session) return;
    await setSessionOutcome(db, session.id, 'break');
    await finish();
    router.push('/break');
  };

  const snooze = (minutes: number) => {
    if (!session) return;
    setSnoozedUntil((s) => ({ ...s, [session.id]: Date.now() + minutes * 60000 }));
  };

  return (
    <Screen>
      <ScreenHeader
        title="Scroll"
        subtitle="Use your feed on purpose."
        mascot={session ? 'calm' : 'happy'}
      />

      {session ? (
        <Rise>
          <View style={styles.session}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="eyebrow" color={colors.pauseMuted} style={{ fontSize: 11 }}>
                {session.app} · session running
              </Text>
              <View style={styles.liveDot} />
            </Row>
            <Text variant="display" color="#F2FBFC">
              {formatClock(elapsed)}
            </Text>
            <ProgressBar
              value={elapsed / limitS}
              color={colors.accent}
              track="rgba(242,251,252,0.18)"
            />
            <Text variant="caption" color="#BFE6EC">
              {elapsed < limitS
                ? `I will check in at ${session.limitMinutes} minutes`
                : `Past your ${session.limitMinutes}-minute limit`}
            </Text>
            <Row gap={10} style={{ marginTop: spacing.sm }}>
              <Button
                label="Take a break"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => void takeBreak()}
              />
              <Button
                label="I am done"
                size="sm"
                kind="outlineLight"
                style={{ flex: 1 }}
                onPress={() => void finish('Session saved. Nice and intentional.')}
              />
            </Row>
          </View>
        </Rise>
      ) : (
        <Rise>
          <Card style={{ gap: spacing.md }}>
            <Text variant="strong">Opening a feed?</Text>
            <Text variant="small" color={colors.textMuted}>
              Start a session first. I will check in gently when your time is up. No blocking.
            </Text>
            <Text variant="caption" color={colors.textSoft}>
              App
            </Text>
            <Chips
              value={app}
              onChange={setApp}
              options={APPS.map((a) => ({ value: a, label: a }))}
            />
            <Text variant="caption" color={colors.textSoft}>
              Limit
            </Text>
            <Chips
              value={limit}
              onChange={setLimit}
              options={LIMITS.map((l) => ({ value: l, label: `${l} min` }))}
            />
            <Button label="Start session" icon="play" onPress={() => void start()} />
          </Card>
        </Rise>
      )}

      <Rise delay={60}>
        <Card style={{ gap: spacing.md }}>
          <Text variant="strong">Your scrolling</Text>
          {stats.weekSessions === 0 ? (
            <Text variant="small" color={colors.textMuted}>
              Nothing tracked yet. Your patterns show up here after a few sessions.
            </Text>
          ) : (
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text variant="heading" style={{ fontSize: 20 }}>
                  {formatMinutes(stats.todayMinutes)}
                </Text>
                <Text variant="caption">Today</Text>
              </View>
              <View>
                <Text variant="heading" style={{ fontSize: 20 }}>
                  {formatMinutes(stats.weekMinutes)}
                </Text>
                <Text variant="caption">This week</Text>
              </View>
              <View>
                <Text variant="heading" style={{ fontSize: 20 }}>
                  {stats.peakHour === null ? '–' : hourLabel(stats.peakHour)}
                </Text>
                <Text variant="caption">Usual time</Text>
              </View>
            </Row>
          )}
        </Card>
      </Rise>

      <Sheet open={due} onClose={() => snooze(10)} mascot="sleepy">
        <Text variant="heading" align="center" style={{ fontSize: 21, lineHeight: 27 }}>
          You have been on {session?.app} for {Math.floor(elapsed / 60)} minutes.
        </Text>
        <Text variant="small" align="center" style={{ marginBottom: spacing.sm }}>
          Still using this time the way you meant to?
        </Text>
        <Button label="Take a break" onPress={() => void takeBreak()} />
        <Button
          label="I am using this on purpose"
          kind="outline"
          onPress={async () => {
            if (!session) return;
            await setSessionOutcome(db, session.id, 'intentional');
            snooze(session.limitMinutes);
            showToast('Got it. Enjoy it on purpose.');
          }}
        />
        <Button
          label="Remind me in 10 minutes"
          kind="ghost"
          size="sm"
          onPress={async () => {
            if (!session) return;
            await setSessionOutcome(db, session.id, 'snooze');
            snooze(10);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  session: {
    backgroundColor: colors.lagoonDeep,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
