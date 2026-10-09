// Rule-based suspicious message / harassment detector (plan.md Phase 6).
// Output is an *indication*, never proof. Keep rules transparent so every flag is explainable.

import type { MessageRiskResult } from '@/ai/types';

export function assessMessage(_text: string): MessageRiskResult {
  throw new Error('TODO(P6): implement assessMessage');
}
