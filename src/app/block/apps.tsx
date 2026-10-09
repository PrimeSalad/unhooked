// Pick apps to guard. Android lists the user's launchable apps (icons, A–Z, search, categories);
// Only real, installed apps are shown; Expo Go and web explain why the list needs the Android build.

import { Icon } from '@/components/Icon';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  canDrawOverlays,
  getLaunchableApps,
  hasUsageAccess,
  type LaunchableApp,
} from '../../../modules/unhooked-guard';

import {
  Avatar,
  Button,
  Chips,
  EmptyState,
  goBack,
  IconButton,
  Segmented,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { addRules, listRules } from '@/db/blockRules';
import { useDbQuery } from '@/db/useDbQuery';
import { NEVER_BLOCK_PACKAGES, type GuardMode } from '@/domain/blocking';
import { isGuardAvailable } from '@/lib/guard';
import { SCHEDULE_PRESETS, type PresetKey } from '@/lib/schedules';
import { useSession } from '@/store/session';

type Filter = 'all' | 'social' | 'video' | 'game' | 'other';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'social', label: 'Social' },
  { value: 'video', label: 'Video' },
  { value: 'game', label: 'Games' },
  { value: 'other', label: 'Other' },
];

export default function PickAppsScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const showToast = useSession((s) => s.showToast);
  const native = isGuardAvailable();
  const { data: rules } = useDbQuery(listRules, []);

  const [apps, setApps] = useState<LaunchableApp[]>([]);
  const [loading, setLoading] = useState(native);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [preset, setPreset] = useState<PresetKey>('always');
  const [mode, setMode] = useState<GuardMode>('pause');

  useEffect(() => {
    if (!native) return;
    getLaunchableApps({ includeIcons: true })
      .then((list) =>
        setApps(
          list.filter((a) => !a.isEssential && !NEVER_BLOCK_PACKAGES.includes(a.packageName)),
        ),
      )
      .finally(() => setLoading(false));
  }, [native]);

  const guarded = useMemo(
    () => new Set(rules.filter((r) => r.kind === 'app').map((r) => r.target)),
    [rules],
  );
  const shown = apps.filter((a) => {
    if (query && !a.label.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'other') return !['social', 'video', 'game'].includes(a.category);
    return a.category === filter;
  });

  const toggle = (pkg: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });

  const save = async () => {
    const items = apps
      .filter((a) => picked.has(a.packageName))
      .map((a) => ({ kind: 'app' as const, target: a.packageName, label: a.label }));
    await addRules(db, items, {
      mode,
      schedule: SCHEDULE_PRESETS.find((p) => p.key === preset)?.schedule ?? null,
    });
    setConfirming(false);
    if (native && (!hasUsageAccess() || !canDrawOverlays())) {
      router.replace('/block/permissions');
      return;
    }
    goBack();
    showToast(
      `${items.length} ${items.length === 1 ? 'app is' : 'apps are'} guarded. I will pause you before they open.`,
    );
  };

  if (!native) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <IconButton icon="back" label="Back" onPress={goBack} />
          <Text variant="heading">Guard apps</Text>
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <EmptyState
            mood="thinking"
            title="Your apps live in the Android app"
            body="To list the apps installed on this phone and pause them, Unhooked needs its Android build. Expo Go and the web cannot see other apps."
          />
          <Text variant="small" color={colors.textMuted}>
            Team setup: connect the phone with USB debugging on, then run{' '}
            <Text variant="small" style={{ fontFamily: fonts.semibold }}>
              npx expo run:android
            </Text>
            . Open Unhooked from the phone, then come back here.
          </Text>
          <Button
            label="Guard a website instead"
            kind="outline"
            onPress={() => router.replace('/block/sites')}
          />
          <Button
            label="Preview the pause"
            kind="ghost"
            size="sm"
            onPress={() =>
              router.push({ pathname: '/shield', params: { label: 'TikTok', preview: '1' } })
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <IconButton icon="back" label="Back" onPress={goBack} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">Guard apps</Text>
          <Text variant="caption">Pick the ones that pull you in. Nothing is preselected.</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            accessibilityLabel="Search apps"
          />
        </View>
        <Chips value={filter} onChange={setFilter} options={FILTERS} />
      </View>

      <FlatList
        data={shown}
        keyExtractor={(a) => a.packageName}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}
        ListEmptyComponent={
          <Text
            variant="small"
            align="center"
            color={colors.textMuted}
            style={{ marginTop: spacing.xl }}
          >
            {loading ? 'Loading your apps…' : 'No apps match.'}
          </Text>
        }
        renderItem={({ item }) => {
          const isGuarded = guarded.has(item.packageName);
          const on = picked.has(item.packageName);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on || isGuarded, disabled: isGuarded }}
              disabled={isGuarded}
              onPress={() => toggle(item.packageName)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
            >
              {item.iconBase64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${item.iconBase64}` }}
                  style={styles.icon}
                />
              ) : (
                <Avatar label={item.label} bg={colors.scrollSoft} fg={colors.scroll} size={42} />
              )}
              <Text variant="strong" style={{ flex: 1 }} numberOfLines={1}>
                {item.label}
              </Text>
              {isGuarded ? (
                <Text variant="caption" color={colors.lagoon}>
                  Guarded
                </Text>
              ) : (
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Icon name="check" size={16} color={colors.bg} /> : null}
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {picked.size > 0 && (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            label={`Next · ${picked.size} ${picked.size === 1 ? 'app' : 'apps'}`}
            kind="ink"
            onPress={() => setConfirming(true)}
          />
        </View>
      )}

      <Sheet open={confirming} onClose={() => setConfirming(false)} mascot="brave">
        <Text variant="heading" align="center">
          When should I step in?
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
            ? 'A 60-second pause and one more "Are you sure?". Never a hard lock.'
            : 'A short breathing pause, then you decide. You can always open it.'}
        </Text>
        <Button
          label={`Guard ${picked.size} ${picked.size === 1 ? 'app' : 'apps'}`}
          style={{ marginTop: spacing.sm }}
          onPress={() => void save()}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: { width: 42, height: 42, borderRadius: 12 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.text, borderColor: colors.text },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
