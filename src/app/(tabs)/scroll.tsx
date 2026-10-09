// Scroll hub: guards (apps + sites with schedules), the Unhook timer, and soft scroll sessions.
// Patterns from Opal (rules, timer, strict mode) and one sec (pause before open, attempt counts).

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
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
    if (!active) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export default function ScrollScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { timerUntil, setTimerUntil, guardOn, fadeAfterMin, setFadeAfterMin } = useSettings();
  const { data: rules, loaded } = useDbQuery(listRules, []);
  const { data: attempts } = useDbQuery(attemptsToday, {});
  const { data: session } = useDbQuery(activeSession, null);
  const { data: stats } = useDbQuery(scrollStats, emptyStats);
  const [editing, setEditing] = useState<GuardRule | null>(null);
  const [timerMin, setTimerMin] = useState<(typeof TIMER_OPTIONS)[number]>('30');

  const timerMs = timerUntil ? new Date(timerUntil).getTime() : 0;
  const now = useNow(timerMs > 0 || !!session);
  const timerLeft = Math.max(0, Math.floor((timerMs - now.getTime()) / 1000));
  const timerOn = timerLeft > 0;
  const appRules = rules.filter((r) => r.kind === 'app');
  const siteRules = rules.filter((r) => r.kind === 'site');
  const native = isGuardAvailable();

  const startTimer = async () => {
    if (!appRules.length) {
      router.push('/block/apps');
      return;
    }
    const until = new Date(Date.now() + Number(timerMin) * 60000).toISOString();
    setTimerUntil(until);
    await logEvent(db, 'block_timer_started', { minutes: Number(timerMin) });
    await syncGuard(rules);
    showToast(`Unhooked for ${formatMinutes(Number(timerMin))}. You got this.`);
  };

  const stopTimer = async () => {
    setTimerUntil(null);
    await syncGuard(rules);
  };

  return (
    <Screen>
      <LargeTitle eyebrow="Use your feed on purpose" title="Scroll" />

      {/* Hero: Unhook timer (Opal-style focus session) */}
      <View style={styles.hero}>
        {timerOn ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="eyebrow" color={colors.pauseMuted} style={{ fontSize: 11 }}>
                Unhooked
              </Text>
              <View style={styles.liveDot} />
            </Row>
            <Row style={{ alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="display" color="#FFF6EC" style={{ fontSize: 52, lineHeight: 56 }}>
                  {formatClock(timerLeft)}
                </Text>
                <Text variant="small" color="#D9BFA8">
                  {appRules.filter((r) => r.enabled).length} apps paused until the timer ends
                </Text>
              </View>
              <Ginto mood="calm" size={96} />
            </Row>
            <Button
              label="End early"
              kind="outlineLight"
              size="sm"
              onPress={() => void stopTimer()}
            />
          </>
        ) : (
          <>
            <Row style={{ alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="eyebrow" color={colors.pauseMuted} style={{ fontSize: 11 }}>
                  Unhook timer
                </Text>
                <Text variant="heading" color="#FFF6EC" style={{ fontSize: 22, lineHeight: 28 }}>
                  Need a real break from your feed?
                </Text>
                <Text variant="small" color="#D9BFA8">
                  Your guarded apps pause until the timer ends.
                </Text>
              </View>
              <Ginto mood="sleepy" size={88} />
            </Row>
            <View style={styles.timerChips}>
              {TIMER_OPTIONS.map((m) => {
                const active = m === timerMin;
                return (
                  <Text
                    key={m}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setTimerMin(m)}
                    variant="strong"
                    color={active ? colors.text : '#FFF6EC'}
                    style={[styles.timerChip, active && { backgroundColor: colors.accent }]}
                  >
                    {formatMinutes(Number(m))}
                  </Text>
                );
              })}
            </View>
            <Button
              label={appRules.length ? 'Start Unhook timer' : 'Pick apps to guard first'}
              icon="lock"
              onPress={() => void startTimer()}
            />
          </>
        )}
      </View>

      {!native && (
        <View style={styles.notice}>
          <Text variant="small" color={colors.text} style={{ flex: 1 }}>
            Guards switch on in the Android app. Here you can set them up and preview the pause.
          </Text>
          <Button
            label="Preview"
            size="sm"
            kind="outline"
            style={{ minHeight: 36 }}
            onPress={() =>
              router.push({
                pathname: '/shield',
                params: { label: appRules[0]?.label ?? 'TikTok', mode: 'pause', preview: '1' },
              })
            }
          />
        </View>
      )}

      <Section title="Guards" action="Add apps" onAction={() => router.push('/block/apps')}>
        {loaded && rules.length === 0 ? (
          <Group>
            <GroupRow
              icon="add-circle"
              iconBg={colors.scrollSoft}
              iconFg={colors.scroll}
              title="Pick the apps that hook you"
              subtitle="Opening one shows a short pause first. You can still open it."
              onPress={() => router.push('/block/apps')}
            />
            <GroupRow
              icon="globe"
              iconBg={colors.scrollSoft}
              iconFg={colors.scroll}
              title="Add a website"
              subtitle="Shopping or video sites in your browser"
              onPress={() => router.push('/block/sites')}
            />
          </Group>
        ) : (
          <Group>
            {rules.map((r) => {
              const live = guardOn && (isGuardActive(r, now) || (timerOn && r.kind === 'app'));
              const n = attempts[r.target] ?? 0;
              return (
                <GroupRow
                  key={r.id}
                  leading={
                    <Avatar
                      label={r.label}
                      bg={live ? colors.scrollSoft : colors.track}
                      fg={colors.scroll}
                    />
                  }
                  title={r.label}
                  subtitle={`${formatSchedule(r.schedule)} · ${r.mode === 'strict' ? 'Strict' : 'Pause'}${n ? ` · opened ${n}× today` : ''}`}
                  onPress={() => setEditing(r)}
                  trailing={
                    <Switch
                      value={r.enabled}
                      onValueChange={(v) => void setRuleEnabled(db, r.id, v)}
                      trackColor={{ true: colors.lagoon, false: colors.track }}
                      thumbColor={colors.white}
                      accessibilityLabel={`Guard ${r.label}`}
                    />
                  }
                />
              );
            })}
            <GroupRow
              icon="globe"
              iconBg={colors.scrollSoft}
              iconFg={colors.scroll}
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

      <Section title="Doomscroll fade">
        <View style={[styles.card, { gap: spacing.md }]}>
          <Text variant="small" color={colors.textMuted}>
            Stay too long in a guarded app and I send a check-in, then your screen slowly washes
            white. You can still use it. It just stops feeling endless.
          </Text>
          <Chips
            value={String(fadeAfterMin)}
            onChange={async (v) => {
              setFadeAfterMin(Number(v));
              await syncGuard(rules);
            }}
            options={[
              { value: '0', label: 'Off' },
              { value: '10', label: '10 min' },
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
            ]}
          />
          <Button
            label="See how it looks"
            kind="outline"
            size="sm"
            icon="play"
            onPress={() => router.push('/fade-preview')}
          />
        </View>
      </Section>

      <ScrollSession session={session} now={now} />

      <Section title="Your scrolling">
        <Group>
          <GroupRow icon="sun" title="Today" value={formatMinutes(stats.todayMinutes)} />
          <GroupRow icon="calendar" title="This week" value={formatMinutes(stats.weekMinutes)} />
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
      </Section>

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
  const [app, setApp] = useState<(typeof SESSION_APPS)[number]>('TikTok');
  const [limit, setLimit] = useState(String(defaultLimit));
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>({});
  const [reminderId, setReminderId] = useState<string | null>(null);

  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const limitS = session ? session.limitMinutes * 60 : 1;
  const due = !!session && elapsed >= limitS && now.getTime() >= (snoozedUntil[session.id] ?? 0);

  const start = async () => {
    const minutes = Number(limit);
    setDefaultLimit(minutes);
    await startSession(db, app, minutes);
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
    <Section title="Scroll timer">
      <View style={[styles.card, { gap: spacing.md }]}>
        {session ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="strong">{session.app}</Text>
              <Text variant="number">{formatClock(elapsed)}</Text>
            </Row>
            <ProgressBar
              value={elapsed / limitS}
              color={elapsed >= limitS ? colors.primary : colors.lagoon}
            />
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
                onPress={() => void takeBreak()}
              />
              <Button
                label="I am done"
                size="sm"
                kind="outline"
                style={{ flex: 1 }}
                onPress={() => void finish('Session saved. Nice and intentional.')}
              />
            </Row>
          </>
        ) : (
          <>
            <Text variant="small" color={colors.textMuted}>
              Opening a feed anyway? Set when to stop. I will check in gently when time is up.
            </Text>
            <Chips
              value={app}
              onChange={setApp}
              options={SESSION_APPS.map((a) => ({ value: a, label: a }))}
            />
            <Chips
              value={limit}
              onChange={setLimit}
              options={LIMITS.map((l) => ({ value: l, label: `${l} min` }))}
            />
            <Button
              label="Start scroll timer"
              kind="ink"
              icon="timer"
              onPress={() => void start()}
            />
          </>
        )}
      </View>

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
    </Section>
  );
}

function RuleSheet({ rule, onClose }: { rule: GuardRule | null; onClose: () => void }) {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<GuardMode>(rule?.mode ?? 'pause');
  const [preset, setPreset] = useState<PresetKey>(presetFor(rule?.schedule ?? null));
  if (!rule) return null;

  return (
    <Sheet open onClose={onClose}>
      <Text variant="heading">{rule.label}</Text>
      <Text variant="caption" style={{ marginBottom: spacing.sm }}>
        {rule.kind === 'app' ? 'App guard' : 'Website guard'}
      </Text>
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
        label="Save"
        style={{ marginTop: spacing.sm }}
        onPress={async () => {
          await updateRule(db, rule.id, {
            mode,
            schedule: SCHEDULE_PRESETS.find((p) => p.key === preset)?.schedule ?? null,
          });
          onClose();
        }}
      />
      <Button
        label="Remove guard"
        kind="ghost"
        size="sm"
        icon="trash"
        onPress={async () => {
          await removeRule(db, rule.id);
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.lagoonDeep,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  timerChips: { flexDirection: 'row', gap: spacing.sm },
  timerChip: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242,251,252,0.12)',
    overflow: 'hidden',
    fontSize: 14,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.shell,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
});
