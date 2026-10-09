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
  Screen,
  ScreenHeader,
  Section,
  Sheet,
  Text,
} from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { addRules, listRules, removeRule } from '@/db/blockRules';
import { useDbQuery } from '@/db/useDbQuery';
import { normalizeDomain } from '@/domain/blocking';
import { isGuardAvailable } from '@/lib/guard';
import { useSession } from '@/store/session';

const SUGGESTED = ['tiktok.com', 'facebook.com', 'youtube.com', 'shopee.ph', 'lazada.com.ph'];

export default function SitesScreen() {
  const db = useSQLiteContext();
  const showToast = useSession((s) => s.showToast);
  const { data: rules } = useDbQuery(listRules, []);
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
    showToast(`${domain} is guarded.`);
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
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Guard websites"
        subtitle="For shopping or video sites in your browser."
      />

      <Field
        label="Website"
        placeholder="Paste a link, like shopee.ph"
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {result && (
        <Text variant="small" color={result.ok ? colors.text : colors.spend}>
          {result.ok ? `Will guard ${result.domain} and its subpages.` : result.error}
        </Text>
      )}
      <Button
        label="Add"
        disabled={!result?.ok}
        onPress={() => result?.ok && void add(result.domain)}
      />

      {sites.length > 0 && (
        <Section title="Guarded sites">
          <Group>
            {sites.map((s) => (
              <GroupRow
                key={s.id}
                leading={<Avatar label={s.label} bg={colors.scrollSoft} fg={colors.scroll} />}
                title={s.label}
                subtitle="Opening it shows a pause first"
                trailing={
                  <IconButton
                    icon="close"
                    label={`Remove ${s.label}`}
                    tone={colors.track}
                    onPress={() => void removeRule(db, s.id)}
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
                  onPress={() => void add(d)}
                />
              }
            />
          ))}
        </Group>
      </Section>

      <Text variant="caption" style={{ lineHeight: 18 }}>
        This is a speed bump, not a lock. Some browsers&apos; Secure DNS or another VPN can get around
        website guards, and you can always remove one.
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
          label="Allow"
          onPress={async () => {
            const domain = disclose;
            setDisclose(null);
            if (domain && (await prepareWebGuard())) await save(domain);
            else showToast('Website guard stays off. App guards still work.');
          }}
        />
        <Button label="Not now" kind="ghost" size="sm" onPress={() => setDisclose(null)} />
      </Sheet>
    </Screen>
  );
}
