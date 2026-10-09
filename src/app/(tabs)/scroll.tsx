// Scroll hub: guards (apps + sites with schedules), the Unhook timer, and soft scroll sessions.
// Patterns from Opal (rules, timer, strict mode) and one sec (pause before open, attempt counts).

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';

import { ActionError } from '@/components/FlowLayout';
import { Icon } from '@/components/Icon';
import {
  Avatar,
  Button,
  Chips,
  Group,
  GroupRow,
  LargeTitle,
  ProgressBar,
  Row,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { attemptsToday, listRules, removeRule, setRuleEnabled, updateRule } from '@/db/blockRules';
import { logEvent } from '@/db/events';
import { activeSession, endSession, scrollStats, setSessionOutcome, startSession } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { formatSchedule, isGuardActive, type GuardMode, type GuardRule } from '@/domain/blocking';
import { elapsedSeconds, formatClock, formatMinutes } from '@/domain/scroll';
import { SCHEDULE_PRESETS, type PresetKey, presetFor } from '@/lib/schedules';
import { isGuardAvailable, syncGuard } from '@/lib/guard';
import { cancelReminder, remindIn } from '@/lib/notifications';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const TIMER_OPTIONS = ['15', '30', '60', '120'] as const;
const SESSION_APPS = ['TikTok', 'Facebook', 'Instagram', 'YouTube', 'X', 'Other'] as const;
const LIMITS = ['10', '20', '30', '45'] as const;
const emptyStats = {
  todayMinutes: 0,
  longestToday: 0,
  weekMinutes: 0,
  weekSessions: 0,
  peakHour: null as number | null,
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), active ? 1000 : 30000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function ScrollScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { timerUntil, setTimerUntil, guardOn, fadeAfterMin, setFadeAfterMin } = useSettings();
  const { data: rules, loaded, error, retry } = useDbQuery(listRules, []);
  const { data: attempts } = useDbQuery(attemptsToday, {});
  const sessionQuery = useDbQuery(activeSession, null);
  const session = sessionQuery.data;
  const statsQuery = useDbQuery(scrollStats, emptyStats);
  const stats = statsQuery.data;
  const [editing, setEditing] = useState<GuardRule | null>(null);
  const [timerMin, setTimerMin] = useState<(typeof TIMER_OPTIONS)[number]>('30');
  const action = useAsyncAction('The guard change could not be completed. Please try again.');
  const { width } = useWindowDimensions();
  const wide = width >= 1100;

  const timerMs = timerUntil ? new Date(timerUntil).getTime() : 0;
  const now = useNow(timerMs > 0 || !!session);
  const timerLeft = Math.max(0, Math.floor((timerMs - now.getTime()) / 1000));
  const timerOn = timerLeft > 0;
  const appRules = rules.filter((r) => r.kind === 'app');
  const siteRules = rules.filter((r) => r.kind === 'site');
  const native = isGuardAvailable();
  const enabledApps = appRules.filter((r) => r.enabled);

  useEffect(() => {
    if (timerUntil && timerMs <= now.getTime()) {
      setTimerUntil(null);
      void syncGuard(rules).catch(() =>
        showToast('The timer ended. Check your guard settings if an app stays paused.'),
      );
    }
  }, [now, rules, setTimerUntil, showToast, timerMs, timerUntil]);

  const startTimer = async () => {
    if (!enabledApps.length) {
      router.push('/block/apps');
      return;
    }
    if (native && !guardOn) {
      showToast('Turn on app guards in Settings before starting.');
      router.push('/settings');
      return;
    }
    const until = new Date(Date.now() + Number(timerMin) * 60000).toISOString();
    await logEvent(db, 'block_timer_started', { minutes: Number(timerMin) });
    setTimerUntil(until);
    try {
      await syncGuard(rules);
    } catch (cause) {
      setTimerUntil(null);
      throw cause;
    }
    showToast(
      native
        ? `Focus timer started for ${formatMinutes(Number(timerMin))}.`
        : 'Timer preview started. Apps are not blocked on this device.',
    );
  };

  const stopTimer = async () => {
    setTimerUntil(null);
    await syncGuard(rules);
  };

  return (
    <Screen>
      <LargeTitle eyebrow="Your attention belongs to you" title="Make a little space." />
      <Text color={colors.textSoft}>
        Set a boundary with your feed. Leave room for everything outside it.
      </Text>

      {!native && (
        <View style={styles.notice}>
          <Icon name="device" size={22} color={colors.text} />
          <Text variant="small" style={{ flex: 1, minWidth: 160 }}>
            App and website guards need the Android app. Here, you can save your setup and preview a
            pause.
          </Text>
          <Button
            label="Preview a pause"
            size="sm"
            kind="outline"
            onPress={() =>
              router.push({
                pathname: '/shield',
                params: { label: appRules[0]?.label ?? 'TikTok', mode: 'pause', preview: '1' },
              })
            }
          />
        </View>
      )}

      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: spacing.xxl }}>
          <View style={styles.hero}>
            {timerOn ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="eyebrow" color={colors.text}>
                    {native ? 'A little time away' : 'Focus timer preview'}
                  </Text>
                  <View style={styles.liveDot} />
                </Row>
                <Row style={{ alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="display"
                      color={colors.text}
                      style={{ fontSize: 52, lineHeight: 56 }}
                    >
                      {formatClock(timerLeft)}
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      {native && guardOn
                        ? `${enabledApps.length} selected apps guarded until the timer ends`
                        : 'A countdown for you. Apps are not blocked on this device.'}
                    </Text>
                  </View>
                </Row>
                <Button
                  label="End focus timer"
                  kind="outline"
                  size="sm"
                  loading={action.pending}
                  onPress={() => void action.run(stopTimer)}
                />
              </>
            ) : (
              <>
                <Row style={{ alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="eyebrow" color={colors.text}>
                      Focus timer
                    </Text>
                    <Text
                      variant="heading"
                      color={colors.text}
                      style={{ fontSize: 24, lineHeight: 30 }}
                    >
                      A break from the feed.
                    </Text>
                    <Text variant="small" color={colors.textMuted}>
                      Choose some time for yourself. Your selected apps can wait.
                    </Text>
                  </View>
                </Row>
                <Segmented
                  value={timerMin}
                  onChange={setTimerMin}
                  options={TIMER_OPTIONS.map((m) => ({
                    value: m,
                    label: formatMinutes(Number(m)),
                  }))}
                />
                <Button
                  label={
                    enabledApps.length
                      ? native
                        ? 'Start my focus time'
                        : 'Preview focus timer'
                      : 'Choose apps to pause'
                  }
                  icon="lock"
                  loading={action.pending}
                  onPress={() => void action.run(startTimer)}
                />
              </>
            )}
          </View>
          <ActionError message={action.error} />
          {!sessionQuery.loaded ? (
            <ActivityIndicator color={colors.text} accessibilityLabel="Loading scroll timer" />
          ) : sessionQuery.error ? (
            <ActionError
              message="Your scroll session could not be loaded."
              onRetry={sessionQuery.retry}
            />
          ) : (
            <ScrollSession session={session} now={now} />
          )}
        </View>
        <View style={{ flex: wide ? 1.1 : undefined, minWidth: 0, gap: spacing.xxl }}>
          <Section
            title="Your boundaries"
            action="Add apps"
            onAction={() => router.push('/block/apps')}
          >
            {!guardOn && (
              <Text variant="small">
                Guards are switched off in Settings. Your choices are saved.
              </Text>
            )}
            {error ? (
              <ActionError message="Your guards could not be loaded." onRetry={retry} />
            ) : !loaded ? (
              <ActivityIndicator color={colors.text} accessibilityLabel="Loading guards" />
            ) : rules.length === 0 ? (
              <Group>
                <GroupRow
                  icon="add-circle"
                  iconBg={colors.surfaceMuted}
                  iconFg={colors.text}
                  title="Choose your apps"
                  subtitle="Add a pause before the automatic tap"
                  onPress={() => router.push('/block/apps')}
                />
                <GroupRow
                  icon="globe"
                  iconBg={colors.surfaceMuted}
                  iconFg={colors.text}
                  title="Add a website"
                  subtitle="Shopping or video sites in your browser"
                  onPress={() => router.push('/block/sites')}
                />
              </Group>
            ) : (
              <Group>
                {rules.map((r) => {
                  const live =
                    native &&
                    r.enabled &&
                    guardOn &&
                    (isGuardActive(r, now) || (timerOn && r.kind === 'app'));
                  const n = attempts[r.target] ?? 0;
                  return (
                    <GroupRow
                      key={r.id}
                      leading={
                        <Avatar
                          label={r.label}
                          bg={live ? colors.surfaceMuted : colors.track}
                          fg={colors.text}
                        />
                      }
                      title={r.label}
                      subtitle={`${r.enabled ? formatSchedule(r.schedule) : 'Switched off'} · ${r.mode === 'strict' ? 'Strict' : 'Pause'}${n ? ` · opened ${n}× today` : ''}`}
                      onPress={() => setEditing(r)}
                      trailing={
                        <Switch
                          value={r.enabled}
                          disabled={action.pending}
                          onValueChange={(v) => void action.run(() => setRuleEnabled(db, r.id, v))}
                          trackColor={{ true: colors.text, false: colors.track }}
                          thumbColor={colors.white}
                          accessibilityLabel={`Guard ${r.label}`}
                        />
                      }
                    />
                  );
                })}
                <GroupRow
                  icon="globe"
                  iconBg={colors.surfaceMuted}
                  iconFg={colors.text}
                  title={siteRules.length ? 'Manage websites' : 'Add a website'}
                  subtitle={
                    siteRules.length
                      ? `${siteRules.length} guarded`
                      : 'Shopping or video sites in your browser'
                  }
                  onPress={() => router.push('/block/sites')}
                />
              </Group>
            )}
          </Section>

          <Section title="A gentler way to stop">
            <View style={[styles.card, { gap: spacing.md }]}>
              <Text variant="small" color={colors.textMuted}>
                On Android, a gradual screen fade can interrupt an endless scroll. Choose when it
                begins in a guarded app, or leave it off.
              </Text>
              <Chips
                value={String(fadeAfterMin)}
                onChange={(v) =>
                  void action.run(async () => {
                    const previous = fadeAfterMin;
                    setFadeAfterMin(Number(v));
                    try {
                      await syncGuard(rules);
                    } catch (cause) {
                      setFadeAfterMin(previous);
                      throw cause;
                    }
                  })
                }
                options={[
                  { value: '0', label: 'Off' },
                  { value: '10', label: '10 min' },
                  { value: '15', label: '15 min' },
                  { value: '30', label: '30 min' },
                ]}
              />
              <Button
                label="Preview the fade"
                kind="outline"
                size="sm"
                icon="play"
                onPress={() => router.push('/fade-preview')}
              />
            </View>
          </Section>

          <Section title="Time you have tracked">
            {statsQuery.error ? (
              <ActionError
                message="Your tracked time could not be loaded."
                onRetry={statsQuery.retry}
              />
            ) : !statsQuery.loaded ? (
              <ActivityIndicator color={colors.text} />
            ) : stats.weekSessions === 0 ? (
              <Text variant="small">
                Start a scroll timer to see your time here. Only sessions you choose to track are
                included.
              </Text>
            ) : (
              <>
                <Group>
                  <GroupRow icon="sun" title="Today" value={formatMinutes(stats.todayMinutes)} />
                  <GroupRow
                    icon="calendar"
                    title="This week"
                    value={formatMinutes(stats.weekMinutes)}
                  />
                  <GroupRow
                    icon="moon"
                    title="Usual time"
                    value={
                      stats.peakHour === null
                        ? '–'
                        : `${stats.peakHour % 12 === 0 ? 12 : stats.peakHour % 12} ${stats.peakHour >= 12 ? 'PM' : 'AM'}`
                    }
                  />
                </Group>
                <Text variant="caption">
                  From your scroll timers, rather than total device screen time.
                </Text>
              </>
            )}
          </Section>
        </View>
      </View>

      <RuleSheet key={editing?.id ?? 'none'} rule={editing} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function ScrollSession({
  session,
  now,
}: {
  session: Awaited<ReturnType<typeof activeSession>>;
  now: Date;
}) {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const defaultLimit = useSettings((s) => s.scrollLimitMinutes);
  const setDefaultLimit = useSettings((s) => s.setScrollLimit);
  const scrollPauseUntil = useSession((s) => s.scrollPauseUntil);
  const snoozeScrollPause = useSession((s) => s.snoozeScrollPause);
  const scrollReminderIds = useSession((s) => s.scrollReminderIds);
  const setScrollReminderId = useSession((s) => s.setScrollReminderId);
  const [app, setApp] = useState<(typeof SESSION_APPS)[number]>('TikTok');
  const [limit, setLimit] = useState(String(defaultLimit));
  const action = useAsyncAction('Your session could not be updated. Please try again.');

  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const limitS = session ? session.limitMinutes * 60 : 1;
  const due =
    !!session && elapsed >= limitS && now.getTime() >= (scrollPauseUntil[session.id] ?? 0);

  const start = async () => {
    const minutes = Number(limit);
    setDefaultLimit(minutes);
    await startSession(db, app, minutes);
    const started = await activeSession(db);
    if (!started) return;
    const reminderId = await remindIn(
      minutes * 60,
      'Quick check-in',
      'Still scrolling on purpose?',
    );
    setScrollReminderId(started.id, reminderId);
    if (!reminderId)
      showToast('Timer started. Return here for your check-in; device reminders are unavailable.');
  };
  const finish = async (msg?: string) => {
    if (!session) return;
    await endSession(db, session.id);
    await cancelReminder(scrollReminderIds[session.id]);
    setScrollReminderId(session.id, null);
    if (msg) showToast(msg);
  };
  const takeBreak = async () => {
    if (!session) return;
    await setSessionOutcome(db, session.id, 'break');
    await finish();
    router.push('/break');
  };
  const openScrollPause = async () => {
    if (!session) return;
    await cancelReminder(scrollReminderIds[session.id]);
    setScrollReminderId(session.id, null);
    snoozeScrollPause(session.id, Date.now() + session.limitMinutes * 60000);
    router.push({
      pathname: '/pause',
      params: {
        kind: 'scroll',
        sessionId: session.id,
        app: session.app,
        minutes: String(Math.floor(elapsed / 60)),
      },
    });
  };
  const snooze = async (minutes: number) => {
    if (!session) return;
    snoozeScrollPause(session.id, Date.now() + minutes * 60000);
    await cancelReminder(scrollReminderIds[session.id]);
    setScrollReminderId(
      session.id,
      await remindIn(minutes * 60, 'Time check', 'Still using this time the way you meant to?'),
    );
  };

  return (
    <Section title="Scrolling with intention">
      <View style={[styles.card, { gap: spacing.md }]}>
        {session ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="strong">{session.app}</Text>
              <Text variant="number">{formatClock(elapsed)}</Text>
            </Row>
            <ProgressBar value={elapsed / limitS} color={colors.primary} />
            <Text variant="caption">
              {elapsed < limitS
                ? `I will check in at ${session.limitMinutes} minutes`
                : `Past your ${session.limitMinutes}-minute limit`}
            </Text>
            <Row gap={10}>
              <Button
                label="Take a break"
                size="sm"
                style={{ flex: 1 }}
                loading={action.pending}
                onPress={() => void action.run(takeBreak)}
              />
              <Button
                label="I am done"
                size="sm"
                kind="outline"
                style={{ flex: 1 }}
                disabled={action.pending}
                onPress={() => void action.run(() => finish('Session saved.'))}
              />
            </Row>
          </>
        ) : (
          <>
            <Text variant="small" color={colors.textMuted}>
              Planning some time on your feed? Choose an app and a limit. Your timer checks in when
              time is up.
            </Text>
            <Text variant="caption">What are you opening?</Text>
            <Chips
              value={app}
              onChange={setApp}
              options={SESSION_APPS.map((a) => ({ value: a, label: a }))}
            />
            <Text variant="caption">Check in after</Text>
            <Chips
              value={limit}
              onChange={setLimit}
              options={LIMITS.map((l) => ({ value: l, label: `${l} min` }))}
            />
            <Button
              label="Start scroll timer"
              kind="ink"
              icon="timer"
              loading={action.pending}
              onPress={() => void action.run(start)}
            />
            <Text variant="caption">
              This tracks a session you start yourself. Device reminders are optional.
            </Text>
          </>
        )}
      </View>
      <ActionError message={action.error} />

      <Sheet open={due} onClose={() => !action.pending && void action.run(() => snooze(10))}>
        <Text variant="heading" align="center" style={{ fontSize: 21, lineHeight: 27 }}>
          Your {session?.app} timer reached {Math.floor(elapsed / 60)} minutes.
        </Text>
        <Text variant="small" align="center" style={{ marginBottom: spacing.sm }}>
          Still using this time the way you meant to?
        </Text>
        <ActionError message={action.error} />
        <Button
          label="Check in with Ginto"
          loading={action.pending}
          onPress={() => void action.run(openScrollPause)}
        />
        <Button
          label="I am using this on purpose"
          kind="outline"
          disabled={action.pending}
          onPress={() =>
            void action.run(async () => {
              if (!session) return;
              await setSessionOutcome(db, session.id, 'intentional');
              await snooze(session.limitMinutes);
              showToast('Got it. Enjoy it on purpose.');
            })
          }
        />
        <Button
          label="Remind me in 10 minutes"
          kind="ghost"
          size="sm"
          disabled={action.pending}
          onPress={() =>
            void action.run(async () => {
              if (!session) return;
              await setSessionOutcome(db, session.id, 'snooze');
              await snooze(10);
            })
          }
        />
      </Sheet>
    </Section>
  );
}

function RuleSheet({ rule, onClose }: { rule: GuardRule | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<GuardMode>(rule?.mode ?? 'pause');
  const [preset, setPreset] = useState<PresetKey>(presetFor(rule?.schedule ?? null));
  const [removing, setRemoving] = useState(false);
  const action = useAsyncAction('Your guard could not be updated. Please try again.');
  if (!rule) return null;

  return (
    <Sheet open onClose={() => !action.pending && onClose()}>
      <Text variant="heading">{rule.label}</Text>
      <Text variant="caption" style={{ marginBottom: spacing.sm }}>
        {rule.kind === 'app' ? 'App guard' : 'Website guard'}
      </Text>
      {removing ? (
        <>
          <Text>
            Remove this guard? {rule.label} will no longer have this boundary. You can add it again
            later.
          </Text>
          <ActionError message={action.error} />
          <Button
            label="Remove this guard"
            loading={action.pending}
            onPress={() =>
              void action.run(async () => {
                await removeRule(db, rule.id);
                onClose();
              })
            }
          />
          <Button
            label="Keep guard"
            kind="outline"
            disabled={action.pending}
            onPress={() => setRemoving(false)}
          />
        </>
      ) : (
        <>
          <Text variant="caption" color={colors.textSoft}>
            When
          </Text>
          <Chips
            value={preset}
            onChange={setPreset}
            options={SCHEDULE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
          <Text variant="caption" color={colors.textSoft} style={{ marginTop: spacing.sm }}>
            How firm
          </Text>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pause', label: 'Pause' },
              { value: 'strict', label: 'Strict' },
            ]}
          />
          <Text variant="caption">
            {mode === 'strict'
              ? '60-second pause and one more "Are you sure?" before it opens.'
              : 'A short breathing pause, then you decide.'}
          </Text>
          <Button
            label="Save boundary"
            loading={action.pending}
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              void action.run(async () => {
                await updateRule(db, rule.id, {
                  mode,
                  schedule: SCHEDULE_PRESETS.find((p) => p.key === preset)?.schedule ?? null,
                });
                onClose();
              })
            }
          />
          <Button
            label="Remove guard"
            kind="ghost"
            size="sm"
            icon="trash"
            disabled={action.pending}
            onPress={() => setRemoving(true)}
          />
          <ActionError message={action.error} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  columns: { gap: spacing.xxl },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxxl },
  hero: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  notice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  card: {
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
