// Ask Ginto: chat grounded in the user's own records. Local by default, Claude when opted in.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLOUD_URL, cloudReply, localReply, type ChatMessage } from '@/ai/chat';
import { Ginto } from '@/components/mascot/Ginto';
import { goBack, IconButton, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { getOverview } from '@/db/repo';
import { useSettings } from '@/store/settings';

const SUGGESTIONS = [
  'Can I afford ₱1,500?',
  'What do I owe this month?',
  'How much did I scroll today?',
  'Should I borrow ₱2,000?',
  'I feel stressed about money',
];

let seq = 0;
const nextId = () => `m${Date.now()}-${seq++}`;

export default function ChatScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const name = useSettings((s) => s.name);
  const budget = useSettings((s) => s.budget);
  const cloud = useSettings((s) => s.cloudAiEnabled) && !!CLOUD_URL;
  const scroller = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'ginto',
      text: `Hi${name ? `, ${name}` : ''}! Ask me about your budget, debts, purchases or scrolling. I answer from your own records${cloud ? '' : ', right here on your phone'}.`,
      source: 'local',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setTyping(true);

    const ctx = { name, budget, overview: await getOverview(db) };
    let reply: ChatMessage;
    try {
      if (!cloud) throw new Error('local');
      reply = {
        id: nextId(),
        role: 'ginto',
        text: await cloudReply(history.slice(1), ctx),
        source: 'cloud',
      };
    } catch (e) {
      await new Promise((r) => setTimeout(r, 650)); // a beat, so it reads like a reply
      const fellBack = cloud && e instanceof Error && e.message !== 'local';
      reply = {
        id: nextId(),
        role: 'ginto',
        text:
          (fellBack ? 'I could not reach the cloud, so here is my on-device answer. ' : '') +
          localReply(text, ctx),
        source: 'local',
      };
    }
    setMessages((m) => [...m, reply]);
    setTyping(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="chevron-back" label="Back" onPress={goBack} />
        <Ginto mood={typing ? 'thinking' : 'happy'} size={58} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">Ginto</Text>
          <StatusLine cloud={cloud} />
        </View>
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ginto]}>
            <Text
              variant="body"
              color={m.role === 'user' ? colors.bg : colors.text}
              style={{ fontSize: 15 }}
            >
              {m.text}
            </Text>
          </View>
        ))}
        {typing && (
          <View
            style={[
              styles.bubble,
              styles.ginto,
              { flexDirection: 'row', gap: 6, paddingVertical: 16 },
            ]}
          >
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, { opacity: 0.35 + i * 0.25 }]} />
            ))}
          </View>
        )}
        {messages.length === 1 && (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Text variant="eyebrow" style={{ fontSize: 11 }}>
              Try asking
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                onPress={() => void send(s)}
                style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.8 }]}
              >
                <Text variant="small" color={colors.text}>
                  {s}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {messages.length > 1 && !typing && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              onPress={() => void send(s)}
              style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
            >
              <Text variant="caption" color={colors.text}>
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Ginto…"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          accessibilityLabel="Message to Ginto"
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={!input.trim() || typing}
          onPress={() => void send(input)}
          style={({ pressed }) => [
            styles.send,
            (!input.trim() || typing) && { opacity: 0.35 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Ionicons name="arrow-up" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function StatusLine({ cloud }: { cloud: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.status, { backgroundColor: cloud ? colors.lagoon : colors.success }]} />
      <Text variant="caption">
        {cloud ? 'Claude · only your numbers are shared' : 'On-device · private'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  user: { alignSelf: 'flex-end', backgroundColor: colors.text, borderBottomRightRadius: 6 },
  ginto: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  send: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { width: 8, height: 8, borderRadius: 4 },
});
