// Core domain types shared by db, domain logic, AI and UI.
// Keep this file free of React / Expo imports so it stays unit-testable.

import type { Centavos } from './money';

export type ID = string;
export type ISODate = string; // e.g. "2026-10-09T14:00:00.000Z"

// ---------- Debt ----------
export type DebtDirection = 'owed' | 'lent'; // owed = I owe them; lent = they owe me

export interface Debt {
  id: ID;
  direction: DebtDirection;
  counterparty: string; // lender app / person name
  principal: Centavos;
  interestRatePct: number | null; // nominal % per term, user-entered
  dueDate: ISODate | null;
  terms: string | null;
  notes: string | null;
  createdAt: ISODate;
  closedAt: ISODate | null;
}

export interface Payment {
  id: ID;
  debtId: ID;
  amount: Centavos;
  paidAt: ISODate;
  note: string | null;
}

export interface Evidence {
  id: ID;
  debtId: ID | null;
  lender: string;
  incidentDate: ISODate;
  imageUri: string | null; // local file in app document dir
  messageText: string | null;
  riskLevel: RiskLevel | null;
  note: string | null;
  createdAt: ISODate;
}

// ---------- Spend ----------
export type PurchaseStatus = 'planned' | 'cooling' | 'bought' | 'skipped';

export interface PlannedPurchase {
  id: ID;
  item: string;
  price: Centavos;
  isNeed: boolean;
  plannedDate: ISODate | null;
  alternativePrice: Centavos | null;
  status: PurchaseStatus;
  coolingUntil: ISODate | null;
  createdAt: ISODate;
}

export interface BudgetProfile {
  monthlyIncome: Centavos;
  monthlyFixedBills: Centavos;
  savingsGoalMonthly: Centavos;
  payday: number | '15_30' | null; // null/1–31 = monthly; '15_30' = twice monthly
}

// ---------- Scroll ----------
export interface ScrollSession {
  id: ID;
  app: string;
  startedAt: ISODate;
  endedAt: ISODate | null;
  limitMinutes: number;
  outcome: ScrollOutcome | null;
}

export type ScrollOutcome = 'intentional' | 'break' | 'snooze';

// ---------- Pause / Insights ----------
export type PauseKind = 'borrow' | 'checkout' | 'scroll';
export type PauseDecision = 'continue' | 'reconsider' | 'break' | 'save_for_later';

export interface WellnessCheckIn {
  id: ID;
  stress: 1 | 2 | 3 | 4 | 5;
  mood: 1 | 2 | 3 | 4 | 5;
  fatigue: 1 | 2 | 3 | 4 | 5;
  createdAt: ISODate;
}

/** Append-only activity log; the single source for insights + success metrics. */
export type AppEventType =
  | 'debt_added'
  | 'payment_recorded'
  | 'repayment_plan_viewed'
  | 'evidence_added'
  | 'purchase_evaluated'
  | 'purchase_saved_for_later'
  | 'bnpl_calculated'
  | 'pause_shown'
  | 'pause_phrased' // { kind, source: 'model' | 'template', model?, backend?, ms?, rejected? }
  | 'pause_decision'
  | 'scroll_session_started'
  | 'scroll_checkin_answered'
  | 'break_taken'
  | 'checkin_completed'
  | 'message_scanned'
  | 'voice_input_used'
  | 'permissions_reviewed'
  | 'insight_dismissed'
  | 'block_rule_added'
  | 'block_rule_removed'
  | 'block_timer_started'
  | 'block_shield_shown'
  | 'block_decision';

export interface AppEvent {
  id: ID;
  type: AppEventType;
  payload: Record<string, unknown>;
  createdAt: ISODate;
}

// ---------- Safety ----------
export type RiskLevel = 'low' | 'medium' | 'high';

/** Every AI/derived statement is labeled so the UI can show fact vs estimate vs suggestion. */
export type Certainty = 'fact' | 'estimate' | 'suggestion';
