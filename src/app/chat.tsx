// Ask Ginto: chat grounded in the user's own records. Local by default, Claude when opted in.

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
  CLOUD_URL,
  cloudReply,
  contextSummary,
  isCrisis,
  localImageReply,
  localReply,
  localReplyOrNull,
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
import { allowedNumbers, vetModelText } from '@/ai/guard';
import { LOCAL_MODEL_BY_ID, type LocalModelId } from '@/ai/localModels';
import { ensureSpeechModel, isSpeechModelReady, SPEECH_MODEL_BYTES } from '@/ai/speechModel';
import { Ginto } from '@/components/mascot/Ginto';
import { GemmaModelSheet } from '@/components/chat/GemmaModelSheet';
import { Button, goBack, IconButton, Sheet, Text } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { logEvent } from '@/db/events';
import { addEvidence, getOverview } from '@/db/repo';
import { keyboardBehavior, useKeyboardVisible } from '@/hooks/useKeyboard';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';

// The pill border is the focus cue; drop the browser's own focus outline on web.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const SUGGESTIONS = [
  'Kaya ko ba ang ₱1,500?',
  'Ano ang babayaran ko this month?',
  'Gaano katagal akong nag-scroll today?',
  'Okay bang umutang ng ₱2,000?',
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
  const cloudOn = useSettings((s) => s.cloudAiEnabled);
  const setCloudAi = useSettings((s) => s.setCloudAi);
  const localAiModel = useSettings((s) => s.localAiModel);
  const setLocalAiModel = useSettings((s) => s.setLocalAiModel);
  const showToast = useSession((s) => s.showToast);
  const cloud = cloudOn && !!CLOUD_URL;
  const scroller = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'hello',
      role: 'ginto',
      text: `Hi${name ? `, ${name}` : ''}! Tanungin mo ako tungkol sa budget, utang, gastos, o scrolling mo. Sasagot ako gamit ang sarili mong records${cloud ? '' : '—dito lang sa phone mo'}.`,
      source: 'local',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [photo, setPhoto] = useState<ChatMessage['image'] | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [askMicConsent, setAskMicConsent] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [activeBackend, setActiveBackend] = useState<string | null>(null);
  const [answeredWith, setAnsweredWith] = useState<LocalModelId | null>(null);
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
    let mounted = true;
    void warmAndroidLocalModel(localAiModel).then((backend) => {
      if (mounted && backend) setActiveBackend(backend);
    });
    return () => {
      mounted = false;
    };
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
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (!granted) {
      setAskMicConsent(true);
      return;
    }
    await beginVoiceInput();
  };

  const send = async (raw: string, route: 'auto' | 'cloud' | 'local' = 'auto') => {
    const text = raw.trim();
    if ((!text && !photo) || typing) return;
    if (route === 'auto' && photo && !cloud && CLOUD_URL) {
      if (!(await canAnswerImageLocally(localAiModel))) {
        setAskConsent(true);
        return;
      }
    }
    const useCloud = route === 'cloud' || (route === 'auto' && cloud);
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, image: photo ?? undefined };
    setPhoto(null);
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setTyping(true);

    const ctx = { name, budget, overview: await getOverview(db) };
    // Rules compute, the model phrases. Crisis wording never reaches any model (R5).
    const summary = contextSummary(ctx);
    const computed = localReplyOrNull(text, ctx);
    const crisis = isCrisis(text);
    let reply: ChatMessage | undefined;
    try {
      if (!useCloud || crisis) throw new Error('local');
      reply = {
        id: nextId(),
        role: 'ginto',
        text: await cloudReply(history.slice(1), ctx),
        source: 'cloud',
      };
    } catch (e) {
      const fellBack = useCloud && e instanceof Error && e.message !== 'local';
      if (!crisis) {
        try {
          // Prior turns only: the new message is already passed as the question.
          const priorTurns = messages.filter((m) => m.id !== 'hello');
          // Every number the model repeats must already exist in the records summary,
          // the computed answer, or the user's own question. Otherwise keep the rules' reply.
          // Photo amounts come from the user's own document, so they can't be provenance-checked.
          const allowed = userMsg.image
            ? 'any'
            : allowedNumbers([summary, computed ?? '', text]);
          let generation = await generateAndroidLocalReply(
            localAiModel,
            text,
            summary,
            priorTurns,
            computed,
            userMsg.image?.uri,
          );
          if (generation && !vetModelText(generation.text, allowed, 700).ok) {
            // One retry with a stricter instruction when the guard rejects the draft.
            generation = await generateAndroidLocalReply(
              localAiModel,
              text,
              summary,
              priorTurns,
              computed,
              userMsg.image?.uri,
              true,
            );
          }
          if (generation) {
            setActiveBackend(generation.backend);
            if (vetModelText(generation.text, allowed, 700).ok) {
              setAnsweredWith(generation.modelId);
              reply = {
                id: nextId(),
                role: 'ginto',
                text: `${fellBack ? 'I could not reach the cloud, so I answered privately on this phone. ' : ''}${generation.text}`,
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
          text:
            (fellBack ? 'I could not reach the cloud, so here is my on-device answer. ' : '') +
            (userMsg.image ? localImageReply() : localReply(text, ctx)),
          source: 'local',
        };
      }
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
          <StatusLine
            cloud={cloud}
            activeBackend={activeBackend}
            modelName={
              answeredWith
                ? LOCAL_MODEL_BY_ID[answeredWith].name
                : localAiModel === 'auto'
                  ? 'Auto'
                  : LOCAL_MODEL_BY_ID[localAiModel].name
            }
          />
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
      <Sheet open={askConsent} onClose={() => setAskConsent(false)} mascot="thinking">
        <Text variant="heading" align="center">
          Let me read this photo?
        </Text>
        <Text variant="small" align="center" color={colors.textMuted}>
          To read photos, Ginto sends this one picture and your question to Claude, with a
          numbers-only summary of your records. Nothing else leaves your phone.
        </Text>
        <Button
          label="Yes, read photos"
          kind="ink"
          onPress={() => {
            setAskConsent(false);
            setCloudAi(true);
            void send(input, 'cloud');
          }}
        />
        <Button
          label="Keep it on my phone"
          kind="ghost"
          size="sm"
          onPress={() => {
            setAskConsent(false);
            void send(input, 'local');
          }}
        />
      </Sheet>
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
          Android turns your voice into text on this phone. Unhooked does not save the
          recording or upload it. You can review the text before sending.
        </Text>
        <Button
          label="Allow microphone"
          kind="ink"
          onPress={() => void requestMicAndListen()}
        />
        <Button
          label="Not now"
          kind="ghost"
          size="sm"
          onPress={() => setAskMicConsent(false)}
        />
      </Sheet>
      <GemmaModelSheet
        visible={showModelSettings}
        onClose={() => setShowModelSettings(false)}
        modelChoice={localAiModel}
        onModelChoiceChange={setLocalAiModel}
        onBackendChange={setActiveBackend}
      />
    </KeyboardAvoidingView>
  );
}

function StatusLine({
  cloud,
  activeBackend,
  modelName,
}: {
  cloud: boolean;
  activeBackend: string | null;
  modelName: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[styles.status, { backgroundColor: cloud ? colors.lagoon : colors.success }]} />
      <Text variant="caption">
        {cloud
          ? 'Claude · only your numbers are shared'
          : activeBackend
            ? `${modelName} · ${activeBackend}`
            : modelName}
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
  status: { width: 8, height: 8, borderRadius: 4 },
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
