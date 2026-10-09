// Collector calls: turn on screening, pick what happens to numbers in the log, check a number,
// and see recent flagged calls with the reasons. Kept light on purpose: facts only.

import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, ScreenHeader, Segmented, Text } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { recentFlaggedCalls } from '@/db/collectorCalls';
import { listNumberReports } from '@/db/numberReports';
import { useDbQuery } from '@/db/useDbQuery';
import { callReasons, lookupNumber, toggleBlocked, type CallScreenMode } from '@/domain/callScreen';
import { summarizeNumbers } from '@/domain/numberLog';
import { useSettings } from '@/store/settings';

import {
  hasCallScreeningRole,
  isCallScreeningAvailable,
  requestCallScreeningRole,
} from '../../modules/unhooked-guard';

const MODES: { value: Exclude<CallScreenMode, 'off'>; label: string }[] = [
  { value: 'notify', label: 'Notify' },
  { value: 'silence', label: 'Silence' },
  { value: 'reject', label: 'Decline' },
];

const HOW_IT_WORKS = [
  'Block a number here, or add it to Reported numbers (your number log).',
  'Turn on screening here. Android asks once to make Unhooked the caller ID & spam app.',
  'Notify: it still rings, with a notice. Silence: it comes in without ringing. Decline: the call is ended (blocked).',
  'Every flagged call is saved to your Evidence Pack, even when declined.',
  'Blocked numbers are always declined. Other numbers in your log follow the mode above. Only blocked or logged numbers can be silenced or declined. An unknown number calling 3 times in an hour only gets a notice, since it could be family in an emergency.',
  'Calls only, not SMS: to keep a collector text, share it to Unhooked from Messages.',
  'Philippine mobile numbers only (09xx or +639xx); not landlines, international or hidden numbers.',
  'Android 10 or newer, and only while Unhooked holds the caller ID role. Choosing another caller ID app (like Truecaller) stops it.',
];

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

export default function CallsScreen() {
  const { data: calls } = useDbQuery(recentFlaggedCalls, []);
  const { data: reports } = useDbQuery(listNumberReports, []);
  const summaries = useMemo(() => summarizeNumbers(reports), [reports]);
  const mode = useSettings((s) => s.callScreenMode);
  const setMode = useSettings((s) => s.setCallScreenMode);
  const available = isCallScreeningAvailable();
  const [on, setOn] = useState(hasCallScreeningRole);
  const [query, setQuery] = useState('');
  const [showHow, setShowHow] = useState(false);
  const blocked = useSettings((s) => s.blockedNumbers);
  const setBlocked = useSettings((s) => s.setBlockedNumbers);
  const toggle = (number: string) => setBlocked(toggleBlocked(blocked, number));
  const blockLabel = (number: string) => (blocked.includes(number) ? 'Unblock' : 'Block');

  // The user can switch screening off in Android settings; re-check when the app comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setOn(hasCallScreeningRole()));
    return () => sub.remove();
  }, []);

  const lookup = query.trim() ? lookupNumber(query, summaries) : null;

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Collector calls"
        subtitle="Checks who is calling against your number log. It never hears the call."
      />

      {!available ? (
        <Card tone={colors.surfaceMuted} flat>
          <Text variant="small">Needs the Unhooked Android app on Android 10 or newer.</Text>
        </Card>
      ) : !on ? (
        <Card style={{ gap: spacing.md }}>
          <Text variant="small">
            When a number from your log calls, or any number calls 3 times in an hour, you get a
            notice and the call is saved to your Evidence Pack. Nothing is uploaded.
          </Text>
          <Button label="Turn on" onPress={() => void requestCallScreeningRole().then(setOn)} />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Segmented
            options={MODES}
            value={mode === 'off' ? 'notify' : mode}
            onChange={setMode}
          />
          <Text variant="caption">
            Only numbers in your log are silenced or declined. Other repeat callers just get a
            notice.
          </Text>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={() => setShowHow(!showHow)}>
        <Text variant="small" color={colors.primary}>
          {showHow ? 'Hide how it works' : 'How it works'}
        </Text>
      </Pressable>
      {showHow ? (
        <Card tone={colors.surfaceMuted} flat style={{ gap: spacing.xs }}>
          {HOW_IT_WORKS.map((line, i) => (
            <Text key={line} variant="caption">
              {i + 1}. {line}
            </Text>
          ))}
        </Card>
      ) : null}

      <Field
        label="Check a number"
        placeholder="09xx xxx xxxx"
        keyboardType="phone-pad"
        value={query}
        onChangeText={setQuery}
      />
      {lookup ? (
        <View style={styles.row}>
          <Text
            variant="small"
            color={lookup.kind === 'reported' ? colors.danger : colors.textMuted}
            style={{ flex: 1 }}
          >
            {lookup.kind === 'invalid'
              ? 'Enter a Philippine mobile number.'
              : lookup.kind === 'unknown'
                ? 'Not in your number log.'
                : `${lookup.summary.agentName ?? 'Reported'} · ${lookup.summary.reports}× · last ${lookup.summary.lastSeenOn}`}
          </Text>
          {lookup.kind !== 'invalid' ? (
            <Button
              label={blockLabel(lookup.kind === 'reported' ? lookup.summary.number : lookup.number)}
              size="sm"
              kind="outline"
              onPress={() => toggle(lookup.kind === 'reported' ? lookup.summary.number : lookup.number)}
            />
          ) : null}
        </View>
      ) : null}

      {blocked.length ? (
        <>
          <Text variant="eyebrow">Blocked</Text>
          {blocked.map((number) => (
            <View key={number} style={styles.row}>
              <Text variant="small" style={{ flex: 1 }}>
                {number}
              </Text>
              <Button label="Unblock" size="sm" kind="ghost" onPress={() => toggle(number)} />
            </View>
          ))}
        </>
      ) : null}

      <Text variant="eyebrow">Recent</Text>
      {calls.length === 0 ? (
        <Text variant="caption">No flagged calls yet.</Text>
      ) : (
        calls.map((call) => (
          <Card key={`${call.number}-${call.at}`} flat style={{ gap: 2 }}>
            <View style={styles.row}>
              <Text variant="strong" style={{ flex: 1 }}>
                {call.label ?? call.number}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => toggle(call.number)}>
                <Text variant="small" color={colors.primary}>
                  {blockLabel(call.number)}
                </Text>
              </Pressable>
            </View>
            <Text variant="caption">
              {when(call.at)}
              {call.label ? ` · ${call.number}` : ''}
            </Text>
            <Text variant="small">{callReasons(call).join(' · ')}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
