// The shield: shown when a guarded app opens (Android guard service deep-links here) or as a preview.
// one sec pattern: real countdown, attempt count, then the user decides (R1, R4).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goHome } from '../../modules/unhooked-guard';

import { DotPattern } from '@/components/DotPattern';
import { useFrameWidth } from '@/hooks/useFrame';
import { Ginto } from '@/components/mascot/Ginto';
import { Hook } from '@/components/mascot/Hook';
import { CountdownRing } from '@/components/pause/CountdownRing';
import { Button, Chips, Field, goBack, Rise, Row, Sheet, Tag, Text, TopBar } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { attemptsToday } from '@/db/blockRules';
import { logEvent, logEventAndRefresh } from '@/db/events';
import { addPurchase, emptyOverview, getOverview, scrollStats, setPurchaseStatus } from '@/db/repo';
import { useDbQuery } from '@/db/useDbQuery';
import { pauseSecondsFor } from '@/domain/blocking';
import { formatPHP, parsePesoInput } from '@/domain/money';
import { isLateNight, isShoppingApp, shieldMoney } from '@/domain/paydayShield';
import { formatMinutes } from '@/domain/scroll';
import { isGuardAvailable, letThrough } from '@/lib/guard';
import { shortDate, timeLeft } from '@/lib/format';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

const OPEN_FOR = ['5', '10', '15'] as const;

export default function ShieldScreen() {
  const p = useLocalSearchParams<{
    pkg?: string;
    label?: string;
    mode?: string;
    preview?: string;
  }>();
  const label = p.label || 'this app';
  const target = p.pkg || label;
  const strict = p.mode === 'strict';
  const preview = p.preview === '1' || !isGuardAvailable();

  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const width = useFrameWidth();
  const showToast = useSession((s) => s.showToast);
  const base = useSettings((s) => s.pauseSeconds);
  const timerUntil = useSettings((s) => s.timerUntil);
  const seconds = pauseSecondsFor(strict ? 'strict' : 'pause', base);
  const budget = useSettings((s) => s.budget);
  const shopping = isShoppingApp(p.pkg, p.label);
  const late = isLateNight();
  const { data: o } = useDbQuery(getOverview, emptyOverview);
  const money = budget ? shieldMoney(budget, o.spentThisMonth, o.dueThisMonth) : null;
  const [wish, setWish] = useState(false);
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const priceC = parsePesoInput(price);

  const [left, setLeft] = useState(seconds);
  const [attempts, setAttempts] = useState(0);
  const [scrolled, setScrolled] = useState(0);
  const [openFor, setOpenFor] = useState<(typeof OPEN_FOR)[number]>('10');
  const [confirm, setConfirm] = useState(false);
  const locked = left > 0;
  const timer = timerUntil ? timeLeft(timerUntil) : null;

  useEffect(() => {
    void (async () => {
      await logEvent(db, 'block_shield_shown', { target, preview });
      setAttempts((await attemptsToday(db))[target] ?? 1);
      setScrolled((await scrollStats(db)).todayMinutes);
    })();
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [db, preview, target]);

  const decide = (decision: 'close' | 'break' | 'open') =>
    logEventAndRefresh(db, 'block_decision', { target, decision, secondsViewed: seconds });

  const close = async () => {
    await decide('close');
    if (!preview) goHome();
    router.dismissTo('/scroll');
    if (preview) showToast(`On your phone, this sends you home instead of ${label}.`);
  };

  const saveWish = async () => {
    if (!item.trim() || !priceC) return;
    try {
      const id = await addPurchase(db, { item: item.trim(), price: priceC, isNeed: false });
      await setPurchaseStatus(db, id, 'cooling');
      await logEventAndRefresh(db, 'block_decision', {
        target,
        decision: 'wishlist',
        secondsViewed: seconds,
      });
      setWish(false);
      if (!preview) goHome();
      router.dismissTo('/spend');
      showToast(`Saved ${item.trim()}. I will remind you in 24 hours.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save it.');
    }
  };

  const open = async () => {
    setConfirm(false);
    await decide('open');
    if (preview) {
      goBack();
      showToast(`On your phone, ${label} would open for ${openFor} minutes.`);
      return;
    }
    letThrough(target, Number(openFor));
    router.dismissTo('/scroll');
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <DotPattern color="#FFF6EC" opacity={0.1} gap={26} />
      <TopBar icon="close" dark onPress={() => void close()} />
      <Hook
        x={width - spacing.xl - 72}
        y={locked ? 96 : 60}
        shown={locked}
        lineColor="#FFDBA4"
        hookColor="#FFC56B"
      />

      <View style={{ gap: 4, maxWidth: '70%' }}>
        <Text variant="eyebrow" color={colors.pauseMuted}>
          {preview ? 'Preview · ' : ''}
          {shopping ? 'Payday shield' : 'Hook guard'}
        </Text>
        <Text variant="title" color={colors.pauseText} style={{ fontSize: 28, lineHeight: 34 }}>
          {label}
        </Text>
        <Text variant="small" color={colors.pauseMuted}>
          {attempts > 1 ? `Opened ${attempts} times today` : 'First time today'}
          {shopping && late ? ' · late night' : ''}
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        {locked ? (
          <CountdownRing seconds={seconds} size={230}>
            <Ginto mood="calm" size={176} />
          </CountdownRing>
        ) : (
          <Ginto mood="curious" size={150} />
        )}
      </View>

      <View style={{ flex: 1, marginTop: spacing.lg }}>
        {locked ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text variant="heading" color={colors.pauseText} style={{ fontSize: 22 }}>
              {Math.floor((seconds - left) / 4) % 2 === 0 ? 'Breathe in' : 'Breathe out'}
            </Text>
            <Text variant="small" color={colors.pauseMuted}>
              {left}s · {strict ? 'strict guard' : 'choices unlock after the pause'}
            </Text>
          </View>
        ) : (
          <Rise>
            {shopping ? (
              <View style={styles.reflection}>
                <Text variant="heading" color={colors.pauseText}>
                  {late ? 'Late night cart? Look first.' : 'Before you add to cart'}
                </Text>
                {money ? <Tag certainty="estimate" dark /> : null}
                {money ? (
                  <View style={{ gap: 2 }}>
                    <Text
                      variant="display"
                      color={colors.pauseText}
                      style={{ fontSize: 34, lineHeight: 40 }}
                    >
                      {formatPHP(money.perDay)}
                      <Text variant="small" color={colors.pauseMuted}>
                        {' '}
                        / day
                      </Text>
                    </Text>
                    <Text variant="small" color="#FFE9D2">
                      {money.free > 0
                        ? `Estimated daily amount until payday on ${shortDate(money.payday.toISOString())} (${money.days} ${money.days === 1 ? 'day' : 'days'}).`
                        : 'The free-to-spend estimate is at or below zero until payday after bills and repayments.'}
                    </Text>
                  </View>
                ) : (
                  <Text variant="small" color="#FFE9D2">
                    Set your budget in Spend to see a daily estimate.
                  </Text>
                )}
                {o.nextDue ? (
                  <Text variant="small" color="#FFE9D2">
                    {formatPHP(o.nextDue.outstanding)} due to {o.nextDue.debt.counterparty}
                    {o.nextDue.debt.dueDate ? ` on ${shortDate(o.nextDue.debt.dueDate)}` : ''}.
                  </Text>
                ) : null}
                {o.cooling.length > 0 ? (
                  <Text variant="small" color="#FFE9D2">
                    {o.cooling.length === 1
                      ? `${o.cooling[0]!.item} is still cooling off.`
                      : `${o.cooling.length} items are still cooling off.`}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.reflection}>
                <Text variant="heading" color={colors.pauseText}>
                  {timer ? 'Your Unhook timer is still running.' : 'What did you open it for?'}
                </Text>
                <View style={{ gap: 4 }}>
                  <Tag certainty="fact" dark />
                  <Text variant="small" color="#FFE9D2">
                    {scrolled > 0
                      ? `${formatMinutes(scrolled)} of tracked scrolling today.`
                      : 'No tracked scrolling yet today.'}
                    {timer ? ` Timer: ${timer}.` : ''}
                  </Text>
                </View>
                <View style={{ gap: 4 }}>
                  <Tag certainty="suggestion" dark />
                  <Text variant="small" color="#FFE9D2">
                    If it was a reflex, close it and do one small thing offline.
                  </Text>
                </View>
              </View>
            )}
          </Rise>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button label={`Close ${label}`} disabled={locked} onPress={() => void close()} />
        {shopping ? (
          <Button
            label="Save to wishlist for 24h"
            kind="outlineLight"
            disabled={locked}
            onPress={() => setWish(true)}
          />
        ) : (
          <Button
            label="Take a break with Ginto"
            kind="outlineLight"
            disabled={locked}
            onPress={async () => {
              await decide('break');
              router.replace('/break');
            }}
          />
        )}
        <Row style={{ justifyContent: 'space-between' }}>
          <Button
            label="Open anyway"
            kind="ghostLight"
            size="sm"
            disabled={locked}
            onPress={() => setConfirm(true)}
          />
        </Row>
      </View>

      <Sheet open={wish} onClose={() => setWish(false)}>
        <Text variant="heading" align="center">
          Save it, decide tomorrow
        </Text>
        <Text variant="caption" align="center">
          It stays in Spend for 24 hours. If you still want it then, buy it.
        </Text>
        <Field
          label="What is it?"
          value={item}
          onChangeText={setItem}
          placeholder="Wireless earbuds"
        />
        <Field
          label="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="1,299"
        />
        <Button
          label="Save and close"
          kind="ink"
          disabled={!item.trim() || !priceC}
          onPress={() => void saveWish()}
        />
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)} mascot="worried">
        <Text variant="heading" align="center">
          {strict ? 'Still want to open it?' : `Open ${label} for`}
        </Text>
        <Chips
          value={openFor}
          onChange={setOpenFor}
          options={OPEN_FOR.map((m) => ({ value: m, label: `${m} min` }))}
        />
        <Text variant="caption" align="center">
          I will step in again after that.
        </Text>
        <Button label={`Open for ${openFor} minutes`} kind="ink" onPress={() => void open()} />
        <Button label="Never mind, close it" kind="ghost" size="sm" onPress={() => void close()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pause,
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  reflection: {
    backgroundColor: 'rgba(255,246,236,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,246,236,0.14)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
