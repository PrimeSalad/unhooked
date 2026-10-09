// Guard websites: paste a link, see the domain that will be guarded, save.

import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { View } from 'react-native';

import { isWebGuardPrepared, prepareWebGuard } from '../../../modules/unhooked-guard';

import {
  Avatar,
  Button,
  Field,
  Group,
  GroupRow,
  IconButton,
  ScreenHeader,
  Section,
  Sheet,
  Text,
} from '@/components/ui';
import { ActionError, FlowScreen, FormSection } from '@/components/FlowLayout';
import { colors, spacing } from '@/constants/theme';
import { addRules, listRules, removeRule } from '@/db/blockRules';
import { useDbQuery } from '@/db/useDbQuery';
import { normalizeDomain } from '@/domain/blocking';
import { isGuardAvailable } from '@/lib/guard';
import { useSession } from '@/store/session';
import { useAsyncAction } from '@/hooks/useAsyncAction';

const SUGGESTED = ['tiktok.com', 'facebook.com', 'youtube.com', 'shopee.ph', 'lazada.com.ph'];

export default function SitesScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { data: rules, error, retry } = useDbQuery(listRules, []);
  const action = useAsyncAction();
  const native = isGuardAvailable();
  const [text, setText] = useState('');
  const [disclose, setDisclose] = useState<string | null>(null);
  const sites = rules.filter((r) => r.kind === 'site');
  const result = text.trim() ? normalizeDomain(text) : null;

  const save = async (domain: string) => {
    await addRules(db, [{ kind: 'site', target: domain, label: domain }], {
      mode: 'pause',
      schedule: null,
    });
    setText('');
    showToast(
      native
        ? `${domain} is added to your guard list.`
        : `${domain} is saved. Website guards run in the Android build.`,
    );
  };

  const add = async (domain: string) => {
    if (sites.some((s) => s.target === domain)) return;
    if (isGuardAvailable() && !isWebGuardPrepared()) {
      setDisclose(domain);
      return;
    }
    await save(domain);
  };

  return (
    <FlowScreen>
      <ScreenHeader
        back
        title="Leave a little space."
        subtitle="Choose websites where you would like a pause."
      />

      {!native && (
        <View
          style={{ padding: spacing.lg, backgroundColor: colors.surfaceMuted, gap: spacing.sm }}
        >
          <Text variant="strong">Prepare your list here.</Text>
          <Text variant="small">
            Website guards work in the Android build. Saving a site here does not block this browser
            or other apps.
          </Text>
        </View>
      )}
      <ActionError
        message={error ? 'Your saved website list could not be loaded.' : null}
        onRetry={retry}
      />

      <FormSection title="Add a website">
        <Field
          label="Website"
          placeholder="Paste a link, like shopee.ph"
          value={text}
          onChangeText={setText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={result && !result.ok ? result.error : undefined}
        />
        {result && (
          <Text variant="small" color={result.ok ? colors.text : colors.spend}>
            {result.ok ? `Will guard ${result.domain} and its subpages.` : result.error}
          </Text>
        )}
        <Button
          label={
            result?.ok && sites.some((site) => site.target === result.domain)
              ? 'Already on your list'
              : 'Add website'
          }
          disabled={
            !result?.ok ||
            !!error ||
            (result?.ok && sites.some((site) => site.target === result.domain))
          }
          loading={action.pending}
          onPress={() => result?.ok && void action.run(() => add(result.domain))}
        />
      </FormSection>
      <ActionError message={action.error} />

      {sites.length > 0 && (
        <Section title={native ? 'Your guarded websites' : 'Your saved websites'}>
          <Group>
            {sites.map((s) => (
              <GroupRow
                key={s.id}
                leading={<Avatar label={s.label} bg={colors.scrollSoft} fg={colors.scroll} />}
                title={s.label}
                subtitle={
                  native
                    ? 'Included when website guards are enabled'
                    : 'Ready for the Android build'
                }
                trailing={
                  <IconButton
                    icon="close"
                    label={`Remove ${s.label}`}
                    tone={colors.track}
                    onPress={() => void action.run(() => removeRule(db, s.id))}
                  />
                }
              />
            ))}
          </Group>
        </Section>
      )}

      <Section title="Suggestions">
        <Group>
          {SUGGESTED.filter((d) => !sites.some((s) => s.target === d)).map((d) => (
            <GroupRow
              key={d}
              leading={<Avatar label={d} />}
              title={d}
              trailing={
                <IconButton
                  icon="add"
                  label={`Guard ${d}`}
                  tone={colors.track}
                  onPress={() => void action.run(() => add(d))}
                />
              }
            />
          ))}
        </Group>
      </Section>

      <Text variant="caption" style={{ lineHeight: 18 }}>
        This is a speed bump, not a lock. Some browsers&apos; Secure DNS or another VPN can get
        around website guards, and you can always remove one.
      </Text>

      <Sheet open={!!disclose} onClose={() => setDisclose(null)} mascot="brave">
        <Text variant="heading" align="center">
          One permission for websites
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Text variant="small">
            Android will ask to let Unhooked set up a VPN. It is local: only website name lookups go
            through it, and only the sites on your list get a pause.
          </Text>
          <Text variant="small">
            Your browsing is not sent anywhere, not read, and not logged. You can turn it off any
            time.
          </Text>
        </View>
        <Button
          label="Continue to Android permission"
          loading={action.pending}
          onPress={() =>
            void action.run(async () => {
              const domain = disclose;
              if (domain && (await prepareWebGuard())) await save(domain);
              else showToast('Website guard stays off. App guards still work.');
              setDisclose(null);
            })
          }
        />
        <Button label="Not now" kind="ghost" size="sm" onPress={() => setDisclose(null)} />
      </Sheet>
    </FlowScreen>
  );
}
