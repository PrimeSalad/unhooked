import { useEffect } from 'react';

import {
  hasAndroidLocalAiRuntime,
  removeRetiredModels,
  setAndroidPerformanceMode,
  setAndroidProcessor,
  warmAndroidLocalModel,
} from '@/ai/androidLocalAi';
import { useSettings, useSettingsHydrated } from '@/store/settings';

/**
 * Loads the downloaded on-device model shortly after launch so the first AI Pause or chat
 * turn answers within the countdown instead of paying a cold start. No-op without the
 * native runtime (Expo Go, iOS, web) or when no model has been downloaded.
 */
export function useWarmLocalModel(delayMs = 2500) {
  const hydrated = useSettingsHydrated();
  const choice = useSettings((s) => s.localAiModel);
  const mode = useSettings((s) => s.localAiPerformance);
  const processor = useSettings((s) => s.localAiProcessor);

  useEffect(() => {
    if (!hydrated || !hasAndroidLocalAiRuntime()) return;
    const timer = setTimeout(() => {
      void (async () => {
        await removeRetiredModels();
        await setAndroidPerformanceMode(mode);
        await setAndroidProcessor(processor);
        await warmAndroidLocalModel(choice);
      })();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [hydrated, choice, mode, processor, delayMs]);
}
