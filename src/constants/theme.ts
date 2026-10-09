// Design tokens. Brand palette, type and motion match the Ginto prototype
// (prototype/ and plan.md → Brand & mascot). Never hard-code colors or fonts in screens.

export const colors = {
  bg: '#FFF6EC', // Cream
  surface: '#FFFFFF',
  surfaceMuted: '#FFE3CC', // Peach
  border: '#F0E2D4',
  track: '#F3E7DB',
  text: '#2A1608', // Ink
  textSoft: '#5C3A22',
  textMuted: '#7A5B47',
  textFaint: '#B39580',
  primary: '#FF6B1A', // Goldfish — always paired with Ink text, never white
  primaryText: '#2A1608',
  primarySoft: '#FF8A3D',
  link: '#C4450B', // Ember — orange text on light backgrounds
  accent: '#FFB061', // Amber — countdown ring, progress
  pause: '#0B3440', // Deep water — the pause screen
  pauseText: '#FFF6EC',
  pauseMuted: '#8FD3E0',
  lagoon: '#0F5F6E',
  lagoonDeep: '#0F4A57',
  shell: '#DDF0F3',
  danger: '#B3261E', // high-risk messages only, never user setbacks
  success: '#2F8F5B',
  white: '#FFFFFF',
  // Module identity
  debt: '#5E3D8C',
  debtSoft: '#EFE6F7',
  spend: '#B8480A',
  spendSoft: '#FFE3CC',
  scroll: '#0F5F6E',
  scrollSoft: '#DDF0F3',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 24, xxl: 30, pill: 999 } as const;

/** Poppins families. On Android a custom font ignores fontWeight, so pick the family per weight. */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export const shadow = {
  card: {
    shadowColor: '#2A1608',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
} as const;

export const motion = {
  swim: 800, // Ginto moving between positions
  hook: 900, // hook drop / yank
  breath: 4000, // pause breathing: 4s in, 4s out
  rise: 450, // screen content entrance
} as const;

export type ModuleKey = 'debt' | 'spend' | 'scroll';
