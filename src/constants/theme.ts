// Design tokens. Calm, non-alarming palette: Unhooked nudges, it never scolds.
// Use tokens everywhere; never hard-code colors or spacing in screens.

// Brand palette matches the Ginto prototype (see prototype/ and plan.md → Brand & mascot).
export const colors = {
  bg: '#FFF6EC', // Cream
  surface: '#FFFFFF',
  surfaceMuted: '#FFE3CC', // Peach
  border: '#F0E2D4',
  text: '#2A1608', // Ink
  textMuted: '#7A5B47',
  primary: '#FF6B1A', // Goldfish — always paired with Ink text, never white
  primaryText: '#2A1608',
  link: '#C4450B', // Ember — orange text on light backgrounds
  accent: '#FFB061', // Amber — countdown ring, progress
  pause: '#0B3440', // Deep water — the pause screen
  info: '#0F5F6E',
  warning: '#7A4A00',
  danger: '#B3261E', // reserved for high-risk messages, never for user setbacks
  success: '#1E5E3B',
  // Module identity colors
  debt: '#5E3D8C',
  spend: '#C4450B',
  scroll: '#0F5F6E', // Lagoon
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const font = {
  size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type ModuleKey = 'debt' | 'spend' | 'scroll';
