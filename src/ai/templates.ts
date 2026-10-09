// Fixed, offline wording. No template contains a number or a user-specific claim.
// Numbers and recorded facts are added separately by localProvider.

import type { Tone } from './types';

interface CopyTemplate {
  headline: string;
  suggestion: string;
}

type CheckoutCase =
  'missingPurchase' | 'noBudget' | 'unavailableEstimate' | 'conflicts' | 'tight' | 'comfortable';
type BorrowCase = 'withDebt' | 'noDebt';

export const templates = {
  checkout: {
    neutral: {
      missingPurchase: {
        headline: 'What are you thinking of buying?',
        suggestion: 'Add a purchase to see how it fits your budget.',
      },
      noBudget: {
        headline: 'Would this fit today?',
        suggestion: 'Add a monthly budget if you want an estimate, or come back to this later.',
      },
      unavailableEstimate: {
        headline: 'I cannot estimate this from the details available.',
        suggestion: 'Review your budget details before deciding.',
      },
      conflicts: {
        headline: 'This could make a repayment harder.',
        suggestion: 'Saving it for later may give you more room to decide.',
      },
      tight: {
        headline: 'This could leave little room this month.',
        suggestion: 'A cheaper option or a short wait may leave more room.',
      },
      comfortable: {
        headline: 'Based on your budget, this may fit.',
        suggestion: 'If it still feels right after the pause, you can continue.',
      },
    },
    gentle: {
      missingPurchase: {
        headline: 'No rush. Start with the purchase you have in mind.',
        suggestion: 'Add a purchase when you feel ready.',
      },
      noBudget: {
        headline: 'No rush. You can let this sit for a moment.',
        suggestion: 'A budget can help you estimate the impact when you feel ready.',
      },
      unavailableEstimate: {
        headline: 'No rush. The estimate is not ready yet.',
        suggestion: 'You can review your budget details later.',
      },
      conflicts: {
        headline: 'Take a breath. This may make the month harder.',
        suggestion: 'You can save it and decide later.',
      },
      tight: {
        headline: 'Take your time. This may leave little room.',
        suggestion: 'Waiting or looking for another option is okay.',
      },
      comfortable: {
        headline: 'Take your time. Your budget suggests some room.',
        suggestion: 'You can still wait before deciding.',
      },
    },
  },
  borrow: {
    neutral: {
      withDebt: {
        headline: 'Want to review your current obligations first?',
        suggestion: 'You could ask about a payment arrangement first.',
      },
      noDebt: {
        headline: 'Before you borrow, take a breath.',
        suggestion: 'Check the repayment amount and due date before you decide.',
      },
    },
    gentle: {
      withDebt: {
        headline: 'Take a breath. You can review what is due.',
        suggestion: 'A payment arrangement may be worth asking about.',
      },
      noDebt: {
        headline: 'No rush. You have time to look at the terms.',
        suggestion: 'Check the repayment amount and due date when you feel ready.',
      },
    },
  },
  scroll: {
    neutral: {
      headline: 'Still using this time the way you meant to?',
      suggestion: 'A short break may help you decide what to do next.',
    },
    gentle: {
      headline: 'A quick breath before you keep going.',
      suggestion: 'You can rest for a moment and decide afterward.',
    },
  },
} satisfies {
  checkout: Record<Tone, Record<CheckoutCase, CopyTemplate>>;
  borrow: Record<Tone, Record<BorrowCase, CopyTemplate>>;
  scroll: Record<Tone, CopyTemplate>;
};
