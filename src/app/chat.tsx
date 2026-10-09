// Ask Ginto: chat grounded in the user's own records and processed on-device.

import { Icon } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localImageReply, localReply, type ChatMessage } from '@/ai/chat';
import { Button, goBack, IconButton, Text } from '@/components/ui';
import { ActionError } from '@/components/FlowLayout';
import { Ginto } from '@/components/mascot/Ginto';
import { GemmaModelSheet } from '@/components/chat/GemmaModelSheet';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { addEvidence, getOverview } from '@/db/repo';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SUGGESTIONS = [
  'What needs my attention?',
  'Can I safely spend ₱1,500?',
  'What should I pay first?',
  'Should I borrow ₱2,000?',
  'Help me stop scrolling',
];

let seq = 0;
const nextId = () => `m${Date.now()}-${seq++}`;

export default function ChatScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const name = useSettings((s) => s.name);
  const budget = useSettings((s) => s.budget);
  const scrollLimitMinutes = useSettings((s) => s.scrollLimitMinutes);
  const showToast = useSession((s) => s.showToast);
  const scroller = useRef<ScrollView>(null);
  const action = useAsyncAction(
    'Could not access your records. Your message is still here. Please try again.',
  );
  const attachment = useAsyncAction('Could not open or save this image. Please try again.');
  const reduced = useReducedMotion();
  const [savedImages, setSavedImages] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'ginto',
      text: `Hi${name ? `, ${name}` : ''}. Tell me what you are deciding. I can check a price against repayments, find the next debt to protect, or help you step away from a scroll—right here on your phone.`,
      source: 'local',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [photo, setPhoto] = useState<ChatMessage['image'] | null>(null);
  const [showModelSettings, setShowModelSettings] = useState(false);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: false,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a?.uri) return;
    setPhoto({ uri: a.uri });
  };

  const saveEvidence = async (uri: string) => {
    await addEvidence(db, {
      lender: 'From chat',
      imageUri: uri,
      imageMimeType: uri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg',
    });
    setSavedImages((current) => [...current, uri]);
    showToast('Saved to your private Evidence Pack.');
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if ((!text && !photo) || typing) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, image: photo ?? undefined };
    setTyping(true);
    try {
      const ctx = { name, budget, scrollLimitMinutes, overview: await getOverview(db) };
      const reply: ChatMessage = {
        id: nextId(),
        role: 'ginto',
        text: userMsg.image ? localImageReply() : localReply(text, ctx),
        source: 'local',
      };
      setMessages((current) => [...current, userMsg, reply]);
      setInput('');
      setPhoto(null);
    } finally {
      setTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={styles.frame}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton icon="back" label="Back" onPress={goBack} />
          <Ginto mood="happy" size={46} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">Ask Ginto</Text>
            <StatusLine />
          </View>
          <IconButton
            icon="settings"
            label="Chat model settings"
            onPress={() => setShowModelSettings(true)}
          />
        </View>

        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: !reduced })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[styles.bubble, m.role === 'user' ? styles.user : styles.ginto]}
            >
              {m.image ? (
                <Image
                  accessibilityLabel="Your attached evidence image"
                  source={{ uri: m.image.uri }}
                  style={styles.photo}
                />
              ) : null}
              {m.text ? (
                <Text
                  variant="body"
                  color={m.role === 'user' ? colors.bg : colors.text}
                  style={{ fontSize: 15 }}
                >
                  {m.text}
                </Text>
              ) : null}
              {m.role === 'ginto' && m.source ? (
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                  Private · answered on this device
                </Text>
              ) : null}
              {m.image ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: savedImages.includes(m.image.uri) || attachment.pending,
                  }}
                  disabled={savedImages.includes(m.image.uri) || attachment.pending}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                  onPress={() => void attachment.run(() => saveEvidence(m.image!.uri))}
                >
                  <Text
                    variant="caption"
                    color={colors.primarySoft}
                    style={{ textDecorationLine: 'underline' }}
                  >
                    {savedImages.includes(m.image.uri) ? 'Saved as evidence' : 'Save as evidence'}
                  </Text>
                </Pressable>
              ) : null}
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
                  onPress={() => {
                    setInput(s);
                    void action.run(() => send(s));
                  }}
                  style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.8 }]}
                >
                  <Text variant="small" color={colors.text}>
                    {s}
                  </Text>
                  <Icon name="arrow-forward" size={16} color={colors.textFaint} />
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
                onPress={() => {
                  setInput(s);
                  void action.run(() => send(s));
                }}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
              >
                <Text variant="caption" color={colors.text}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {photo && (
          <View style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={styles.previewImg} />
            <Text variant="caption" style={{ flex: 1 }}>
              Photo ready. Add a question or just send.
            </Text>
            <IconButton
              icon="close"
              label="Remove photo"
              tone={colors.track}
              onPress={() => setPhoto(null)}
            />
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <ActionError message={action.error ?? attachment.error} />
        </View>
        {messages.length === 1 && (
          <Text
            variant="caption"
            align="center"
            style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}
          >
            Answers use your saved records. This conversation is not saved after you leave.
          </Text>
        )}

        <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
          <IconButton
            icon="image"
            label="Attach a photo"
            tone={colors.surface}
            onPress={() => void attachment.run(pickPhoto)}
          />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Ginto…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Message to Ginto"
            onSubmitEditing={() => void action.run(() => send(input))}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={(!input.trim() && !photo) || typing}
            onPress={() => void action.run(() => send(input))}
            accessibilityState={{ disabled: (!input.trim() && !photo) || typing, busy: typing }}
            style={({ pressed }) => [
              styles.send,
              ((!input.trim() && !photo) || typing) && { opacity: 0.35 },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <Icon name="arrow-up" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <Button
          label="Scan pasted message text"
          kind="ghost"
          size="sm"
          onPress={() => router.push('/message-check')}
        />
      </View>
      <GemmaModelSheet visible={showModelSettings} onClose={() => setShowModelSettings(false)} />
    </KeyboardAvoidingView>
  );
}

function StatusLine() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.status, { backgroundColor: colors.success }]} />
      <Text variant="caption">On-device · private</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 820, alignSelf: 'center', flex: 1 },
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
    borderRadius: radius.md,
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
  photo: {
    width: 220,
    maxWidth: '100%',
    height: 220,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  previewImg: { width: 48, height: 48, borderRadius: 10 },
});
