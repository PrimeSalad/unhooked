import { localProvider } from './localProvider';
import type { ReflectionProvider } from './types';

// Cloud reflections are a stretch goal (plan.md Phase 7). Until then, always local.
export function getReflectionProvider(): ReflectionProvider {
  return localProvider;
}

export type * from './types';
