// Ask Ginto: chat grounded in the user's own records, answered on this phone.

import { Icon } from '@/components/Icon';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  contextSummary,
  isCrisis,
  localImageReply,
  localReply,
  localReplyOrNull,
  logGapReply,
  logPreview,
  logSavedReply,
  type ChatMessage,
} from '@/ai/chat';
import {
  canAnswerImageLocally,
  cancelAndroidSpeechRecognition,
  generateAndroidLocalReply,
  hasAndroidMultilingualSpeech,
  hasAndroidOnDeviceSpeechRecognition,
  isSpeechRecognitionCancellation,
  recognizeAndroidSpeech,
  recognizeMultilingualSpeech,
  stopAndroidSpeechRecognition,
  warmAndroidLocalModel,
} from '@/ai/androidLocalAi';
import { allowedNumbers, keepsNumbers, soundsTagalog, vetModelText } from '@/ai/guard';
import { ensureSpeechModel, isSpeechModelReady, SPEECH_MODEL_BYTES } from '@/ai/speechModel';
import { Ginto } from '@/components/mascot/Ginto';
import { GemmaModelSheet } from '@/components/chat/GemmaModelSheet';
import { ThinkingBubble, type ThinkingPhase } from '@/components/chat/ThinkingBubble';
import { Button, goBack, IconButton, Sheet, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { openLenders, saveChatLog } from '@/db/chatLog';
import { addEvidence, getOverview } from '@/db/repo';
import { parseChatLog, parsePhotoLog } from '@/domain/chatLog';
import { keyboardBehavior, useKeyboardVisible } from '@/hooks/useKeyboard';
import { readImageText } from '@/lib/ocr';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

// The pill border is the focus cue; drop the browser's own focus outline on web.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const SUGGESTIONS = [
  'Kaya ko ba ang ₱1,500?',
  'Ano ang babayaran ko this month?',
  'Gaano katagal akong nag-scroll today?',
  'Okay bang umutang ng ₱2,000?',
  'Gumastos ako ng ₱150 sa pagkain',
  'Stressed ako sa pera',
];

let seq = 0;
const nextId = () => `m${Date.now()}-${seq++}`;

function voiceInputMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message.includes('Voice input stopped') ||
    message.includes("couldn't make out") ||
    message.includes("didn't hear") ||
    message.includes('Offline English') ||
    message.includes('language')
  ) {
    return "I didn't hear any words. Tap the mic and speak Tagalog, Taglish, or English. No audio was uploaded.";
  }
  return message || 'Please tap the microphone and try again.';
}

export default function ChatScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { models } = useLocalSearchParams<{ models?: string }>();
  const keyboardUp = useKeyboardVisible();
  const name = useSettings((s) => s.name);
  const budget = useSettings((s) => s.budget);
  const localAiModel = useSettings((s) => s.localAiModel);
  const setLocalAiModel = useSettings((s) => s.setLocalAiModel);
  const showToast = useSession((s) => s.showToast);
  const scroller = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'ginto',
      text: `Hi${name ? `, ${name}` : ''}! Tanungin mo ako tungkol sa budget, utang, gastos, o scrolling mo. Sasagot ako gamit ang sarili mong records—dito lang sa phone mo.`,
      source: 'local',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [photo, setPhoto] = useState<ChatMessage['image'] | null>(null);
  const [askMicConsent, setAskMicConsent] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [phase, setPhase] = useState<ThinkingPhase>('thinking');
  const [phaseImage, setPhaseImage] = useState(false);
  const [listening, setListening] = useState(false);
  const [writingSpeech, setWritingSpeech] = useState(false);
  const [speechProgress, setSpeechProgress] = useState<number | null>(null);
  const [askSpeechDownload, setAskSpeechDownload] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void cancelAndroidSpeechRecognition();
    };
  }, []);

  // The download pill deep-links here with ?models=1 to open the sheet.
  useEffect(() => {
    if (models !== '1') return;
    const timer = setTimeout(() => setShowModelSettings(true), 0);
    return () => clearTimeout(timer);
  }, [models]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void warmAndroidLocalModel(localAiModel);
  }, [localAiModel]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a?.base64) return;
    setPhoto({ uri: a.uri, base64: a.base64, mediaType: a.mimeType ?? 'image/jpeg' });
  };

  const saveEvidence = async (uri: string) => {
    await addEvidence(db, { lender: 'From chat', imageUri: uri });
    showToast('Saved to your private Evidence Pack.');
  };

  const beginVoiceInput = async () => {
    if (typing || listening || speechProgress != null) return;
    if (!hasAndroidMultilingualSpeech() && !hasAndroidOnDeviceSpeechRecognition()) {
      Alert.alert(
        'Private voice input unavailable',
        'This phone needs the on-device Tagalog speech model. No network recognizer will be used.',
      );
      return;
    }
    if (hasAndroidMultilingualSpeech() && !(await isSpeechModelReady())) {
      setAskSpeechDownload(true);
      return;
    }

    setListening(true);
    setWritingSpeech(false);
    try {
      const result = hasAndroidMultilingualSpeech()
        ? await recognizeMultilingualSpeech(await ensureSpeechModel())
        : await recognizeAndroidSpeech('en-US');
      if (!mounted.current) return;
      setInput((current) => [current.trim(), result.text].filter(Boolean).join(' '));
      showToast('Voice added. Review it before sending.');
      await logEvent(db, 'voice_input_used', {
        languageTag: result.languageTag,
        hasConfidence: result.confidence != null,
      }).catch(() => undefined);
    } catch (error) {
      if (!mounted.current || isSpeechRecognitionCancellation(error)) return;
      Alert.alert('Voice input stopped', voiceInputMessage(error));
    } finally {
      if (mounted.current) {
        setListening(false);
        setWritingSpeech(false);
      }
    }
  };

  const downloadSpeechAndListen = async () => {
    setAskSpeechDownload(false);
    setSpeechProgress(0);
    try {
      await ensureSpeechModel((value) => {
        if (mounted.current) setSpeechProgress(value);
      });
      if (mounted.current) setSpeechProgress(null);
      await beginVoiceInput();
    } catch (error) {
      if (mounted.current) setSpeechProgress(null);
      Alert.alert(
        'Speech model not ready',
        error instanceof Error
          ? error.message
          : 'The Tagalog speech model could not be downloaded. You can still type.',
      );
    }
  };

  const requestMicAndListen = async () => {
    setAskMicConsent(false);
    const permission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (permission === PermissionsAndroid.RESULTS.GRANTED) {
      await beginVoiceInput();
      return;
    }
    Alert.alert(
      'Microphone not enabled',
      'You can keep typing. Unhooked works normally without microphone access.',
    );
  };

  const handleMicPress = async () => {
    if (listening) {
      setWritingSpeech(true);
      await stopAndroidSpeechRecognition();
      return;
    }
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (!granted) {
      setAskMicConsent(true);
      return;
    }
    await beginVoiceInput();
  };

  const confirmLog = async (id: string, save: boolean) => {
    const card = messages.find((m) => m.id === id);
    if (!card?.log || card.log.state !== 'pending') return;
    const { entry, taglish } = card.log;
    const mark = (state: 'saved' | 'cancelled') =>
      setMessages((all) =>
        all.map((m) => (m.id === id && m.log ? { ...m, log: { ...m.log, state } } : m)),
      );
    if (!save) {
      mark('cancelled');
      return;
    }
    let text: string;
    try {
      await saveChatLog(db, entry);
      mark('saved');
      text = logSavedReply(entry, taglish);
    } catch (e) {
      text = e instanceof Error ? e.message : 'That could not be saved.';
    }
    setMessages((all) => [...all, { id: nextId(), role: 'ginto', text, source: 'local' }]);
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if ((!text && !photo) || typing) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, image: photo ?? undefined };
    setPhoto(null);
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setTyping(true);
    setPhase('thinking');
    setPhaseImage(!!userMsg.image);

    const ctx = { name, budget, overview: await getOverview(db) };
    // Rules compute, the model phrases. Crisis wording never reaches any model (R5).
    const summary = contextSummary(ctx);
    const computed = localReplyOrNull(text, ctx);
    const crisis = isCrisis(text);
    // "Gumastos ako ng 250 sa pagkain": a log, read by rules and saved only after the user confirms.
    const lenders = crisis ? [] : await openLenders(db);
    let logged = crisis || userMsg.image ? null : parseChatLog(text, lenders);
    // A photo with no words (or "i-log mo ito"): read its text on the phone for a receipt or loan screen.
    if (!crisis && userMsg.image && (!text || /\b(i-?log|log|record|save|ilista)\b/i.test(text))) {
      const ocr = await readImageText(userMsg.image.uri);
      if (ocr) logged = parsePhotoLog(ocr, lenders);
    }
    if (logged) {
      // The app speaks Taglish first; a photo with no words gets the same.
      const taglish = !text || soundsTagalog(text);
      const card: ChatMessage =
        logged.kind === 'gap'
          ? { id: nextId(), role: 'ginto', text: logGapReply(logged, taglish), source: 'local' }
          : {
              id: nextId(),
              role: 'ginto',
              text: logPreview(logged, taglish),
              source: 'local',
              log: { entry: logged, taglish, state: 'pending' },
            };
      setMessages((m) => [...m, card]);
      setTyping(false);
      return;
    }
    let reply: ChatMessage | undefined;
    if (!crisis) {
      try {
        // Prior turns only: the new message is already passed as the question.
        const priorTurns = messages.filter((m) => m.id !== 'hello');
        // Every number the model repeats must already exist in the records summary,
        // the computed answer, or the user's own question. Otherwise keep the rules' reply.
        // Photo amounts come from the user's own document, so they can't be provenance-checked.
        const allowed = userMsg.image ? 'any' : allowedNumbers([summary, computed ?? '', text]);
        const onPhase = (next: ThinkingPhase) => setPhase(next);
        let generation = await generateAndroidLocalReply(
          localAiModel,
          text,
          summary,
          priorTurns,
          computed,
          userMsg.image?.uri,
          false,
          onPhase,
        );
        // A rephrasing must also keep every number the rules computed, or the rules' reply stands.
        const passes = (draft: string) =>
          vetModelText(draft, allowed, 700).ok && (!computed || keepsNumbers(draft, computed));
        if (generation && !passes(generation.text)) {
          // One retry with a stricter instruction when the guard rejects the draft.
          generation = await generateAndroidLocalReply(
            localAiModel,
            text,
            summary,
            priorTurns,
            computed,
            userMsg.image?.uri,
            true,
            onPhase,
          );
        }
        if (generation) {
          if (passes(generation.text)) {
            reply = {
              id: nextId(),
              role: 'ginto',
              text: generation.text,
              source: 'local',
            };
          }
        }
      } catch (err) {
        // Model startup, inference failure or timeout: keep the deterministic offline answer.
        if (__DEV__) console.warn('Local chat model failed', err);
      }
    }

    if (!reply) {
      await new Promise((r) => setTimeout(r, 250));
      reply = {
        id: nextId(),
        role: 'ginto',
        text: userMsg.image
          ? localImageReply(await canAnswerImageLocally(localAiModel))
          : localReply(text, ctx),
        source: 'local',
      };
    }
    if (reply) setMessages((m) => [...m, reply]);
    setTyping(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={keyboardBehavior}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="back" label="Back" onPress={goBack} />
        <Ginto mood={typing ? 'thinking' : 'happy'} size={58} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">Ginto</Text>
          <RotatingTip />
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
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.user : styles.ginto]}>
            {m.image ? <Image source={{ uri: m.image.uri }} style={styles.photo} /> : null}
            {m.text ? (
              <Text
                variant="body"
                color={m.role === 'user' ? colors.bg : colors.text}
                style={{ fontSize: 15 }}
              >
                {m.text}
              </Text>
            ) : null}
            {m.log?.state === 'pending' ? (
              <View style={styles.logActions}>
                <Button
                  label={m.log.taglish ? 'I-save' : 'Save'}
                  size="sm"
                  onPress={() => void confirmLog(m.id, true)}
                />
                <Button
                  label={m.log.taglish ? 'Huwag' : 'Cancel'}
                  kind="ghost"
                  size="sm"
                  onPress={() => void confirmLog(m.id, false)}
                />
              </View>
            ) : m.log ? (
              <Text variant="caption" color={colors.textMuted}>
                {m.log.state === 'saved'
                  ? m.log.taglish ? 'Na-save' : 'Saved'
                  : m.log.taglish ? 'Hindi na-save' : 'Not saved'}
              </Text>
            ) : null}
            {m.image ? (
              <Pressable accessibilityRole="button" onPress={() => void saveEvidence(m.image!.uri)}>
                <Text
                  variant="caption"
                  color={colors.surfaceMuted}
                  style={{ textDecorationLine: 'underline' }}
                >
                  Save as evidence
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {typing && (
          <ThinkingBubble
            phase={phase}
            modelName={null}
            image={phaseImage}
            style={[styles.bubble, styles.ginto]}
          />
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

      {listening ? (
        <View style={styles.listening}>
          <View style={styles.listeningDot} />
          <Text variant="caption" color={colors.textMuted}>
            {writingSpeech
              ? 'Writing that down on this phone…'
              : 'Listening… it stops when you pause.'}
          </Text>
        </View>
      ) : null}

      <View
        style={[styles.composer, { paddingBottom: (keyboardUp ? 0 : insets.bottom) + spacing.md }]}
      >
        <IconButton
          icon="image"
          label="Attach a photo"
          tone={colors.surface}
          onPress={() => void pickPhoto()}
        />
        {Platform.OS === 'android' ? (
          <IconButton
            icon="mic"
            label={listening ? 'Finish voice input' : 'Speak a message'}
            tone={listening ? colors.primarySoft : colors.surface}
            color={listening ? colors.primary : colors.text}
            onPress={() => void handleMicPress()}
          />
        ) : null}
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={listening ? 'Listening…' : 'Ask Ginto…'}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, webNoOutline]}
          accessibilityLabel="Message to Ginto"
          multiline
          maxLength={500}
          submitBehavior="submit"
          onSubmitEditing={() => void send(input)}
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={(!input.trim() && !photo) || typing}
          onPress={() => void send(input)}
          style={({ pressed }) => [
            styles.send,
            ((!input.trim() && !photo) || typing) && { opacity: 0.35 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Icon name="arrow-up" size={22} color={colors.primary} />
        </Pressable>
      </View>
      {speechProgress != null ? (
        <View style={styles.listening}>
          <View style={styles.listeningDot} />
          <Text variant="caption" color={colors.textMuted}>
            Downloading Tagalog speech… {Math.round(speechProgress * 100)}%. It stays on this phone.
          </Text>
        </View>
      ) : null}
      <Sheet open={askSpeechDownload} onClose={() => setAskSpeechDownload(false)} mascot="calm">
        <Text variant="heading" align="center">
          Download clearer Tagalog speech?
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          About {Math.round(SPEECH_MODEL_BYTES / 1_000_000)} MB. This hears Tagalog and Taglish more
          clearly, then stops on its own when you pause. The recording is not saved or uploaded.
        </Text>
        <Button
          label="Download and use mic"
          kind="ink"
          onPress={() => void downloadSpeechAndListen()}
        />
        <Button
          label="Not now"
          kind="ghost"
          size="sm"
          onPress={() => setAskSpeechDownload(false)}
        />
      </Sheet>
      <Sheet open={askMicConsent} onClose={() => setAskMicConsent(false)} mascot="calm">
        <Text variant="heading" align="center">
          Use your microphone?
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          Android turns your voice into text on this phone. Unhooked does not save the recording or
          upload it. You can review the text before sending.
        </Text>
        <Button label="Allow microphone" kind="ink" onPress={() => void requestMicAndListen()} />
        <Button label="Not now" kind="ghost" size="sm" onPress={() => setAskMicConsent(false)} />
      </Sheet>
      <GemmaModelSheet
        visible={showModelSettings}
        onClose={() => setShowModelSettings(false)}
        modelChoice={localAiModel}
        onModelChoiceChange={setLocalAiModel}
        onBackendChange={() => undefined}
      />
    </KeyboardAvoidingView>
  );
}

const TIPS = [
  'You can log anything here',
  'Try: “gumastos ako ng 250 sa pagkain”',
  'Send a receipt photo to log it',
  'Ask: “ano ang babayaran ko this month?”',
  'Tap the mic and talk in Taglish',
  'Everything stays on your phone',
];

/** A quiet hint under Ginto's name that changes every few seconds. */
function RotatingTip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % TIPS.length), 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text variant="caption" numberOfLines={1}>
      {TIPS[i]}
    </Text>
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
  logActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
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
    alignItems: 'flex-end',
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
    maxHeight: 120,
    borderRadius: 25,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'center',
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
  photo: { width: 220, height: 220, borderRadius: radius.md, marginBottom: spacing.sm },
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
  listening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  listeningDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
