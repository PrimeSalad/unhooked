import { localProvider } from './localProvider';
import type { ReflectionProvider } from './types';

// Reflections are always generated on the phone.
export function getReflectionProvider(): ReflectionProvider {
  return localProvider;
}

export type * from './types';
