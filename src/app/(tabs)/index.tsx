import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { Ginto } from '@/components/mascot/Ginto';
import { Button, IconButton, ListRow, Rise, Row, Screen, Stat, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { demoPurchase, demoScroll, demoUser } from '@/demo/ana';
import { useSession } from '@/store/session';
import { useSettings, useSettingsHydrated } from '@/store/settings';

function todayLabel() {
  return new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TodayScreen() {
  const hydrated = useSettingsHydrated();
  const onboarded = useSettings((s) => s.onboarded);
  const { pauses, breaks, cooling } = useSession();

  if (!hydrated) return null;
  if (!onboarded) return <Redirect href="/welcome" />;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text variant="caption">{todayLabel()}</Text>
          <Text variant="title">Hi, {demoUser.name}</Text>
        </View>
        <Row gap={spacing.sm}>
          <IconButton
            icon="help-buoy-outline"
            label="Help and safety"
            onPress={() => router.push('/help')}
          />
          <IconButton
            icon="settings-outline"
            label="Privacy and settings"
            onPress={() => router.push('/settings')}
          />
        </Row>
      </Row>

      <Rise>
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.xl,
            padding: spacing.xl,
            paddingRight: 132,
            minHeight: 148,
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text variant="heading" style={{ fontSize: 22, lineHeight: 26 }}>
            {pauses} hooks dodged today
          </Text>
          <Text variant="small">
            {cooling > 0
              ? 'Earbuds are cooling off and your repayment is still covered. Nice and steady.'
              : 'You checked 2 purchases and took 2 scroll breaks. Nice and steady.'}
          </Text>
          <Ginto mood="happy" size={124} style={{ position: 'absolute', right: 6, top: 12 }} />
        </View>
      </Rise>

      <Rise delay={60}>
        <Row gap={10}>
          <Stat value={pauses} label="Pauses" />
          <Stat value={breaks} label="Breaks" />
          <Stat value={cooling} label="Cooling off" />
        </Row>
      </Rise>

      <Rise delay={120} style={{ gap: 10 }}>
        <ListRow
          icon="wallet-outline"
          iconBg={colors.debtSoft}
          iconFg={colors.debt}
          title="₱3,000 due in 6 days"
          subtitle="Pera Agad · Oct 15"
          onPress={() => router.push('/debt')}
        />
        <ListRow
          icon="bag-handle-outline"
          iconBg={colors.spendSoft}
          iconFg={colors.spend}
          title={
            cooling > 0 ? 'Earbuds saved for 24 hours' : `Earbuds · ${demoPurchase.price} to check`
          }
          subtitle={cooling > 0 ? 'I will check in tomorrow, 11:40 PM' : 'Planned for tonight'}
          onPress={() => router.push('/spend')}
        />
        <ListRow
          icon="phone-portrait-outline"
          iconBg={colors.scrollSoft}
          iconFg={colors.scroll}
          title={`${demoScroll.today} scrolling today`}
          subtitle={`Longest session ${demoScroll.longest} · ${demoScroll.app}`}
          onPress={() => router.push('/scroll')}
        />
      </Rise>

      <Rise delay={180} style={{ gap: 10 }}>
        <Row gap={10}>
          <Button
            label="About to buy"
            onPress={() => router.push('/spend')}
            style={{ flex: 1 }}
            size="sm"
          />
          <Button
            label="Want to borrow"
            kind="outline"
            onPress={() => router.push({ pathname: '/pause', params: { kind: 'borrow' } })}
            style={{ flex: 1 }}
            size="sm"
          />
        </Row>
        <Button
          label="How are you feeling today?"
          kind="ghost"
          icon="heart-outline"
          size="sm"
          onPress={() => router.push('/check-in')}
        />
      </Rise>
    </Screen>
  );
}
