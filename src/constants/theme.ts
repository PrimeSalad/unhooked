// Design tokens. Brand palette, type and motion match the Ginto prototype
// (prototype/ and plan.md → Brand & mascot). Never hard-code colors or fonts in screens.

export const colors = {
  bg: '#F7F5EF',
  surface: '#FFFDF8',
  surfaceMuted: '#ECEFE7',
  border: '#DCE1D6',
  track: '#E3E8DD',
  text: '#203D35',
  textSoft: '#4D5E54',
  textMuted: '#657167',
  textFaint: '#728074',
  primary: '#F07842',
  primaryText: '#20352D',
  primarySoft: '#F9C9AD',
  link: '#A34320',
  accent: '#F07842',
  pause: '#203D35',
  pauseText: '#F7F5EF',
  pauseMuted: '#CBD7CA',
  lagoon: '#3E6653',
  lagoonDeep: '#203D35',
  shell: '#EDF0E8',
  danger: '#B3261E', // high-risk messages only, never user setbacks
  success: '#326846',
  white: '#FFFFFF',
  // Module identity
  debt: '#526441',
  debtSoft: '#E9EDDF',
  spend: '#A34320',
  spendSoft: '#FAEBDD',
  scroll: '#386257',
  scrollSoft: '#E5EDE5',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

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
    shadowColor: '#203D35',
    shadowOpacity: 0.025,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
} as const;

export const motion = {
  swim: 800, // Ginto moving between positions
  hook: 900, // hook drop / yank
  breath: 4000, // pause breathing: 4s in, 4s out
  rise: 180,
} as const;

export type ModuleKey = 'debt' | 'spend' | 'scroll';

export const layout = {
  /** Room the floating tab bar takes at the bottom of tab screens. */
  tabBarSpace: 100,
  sidebarWidth: 240,
  desktop: 1000,
  contentWidth: 1120,
} as const;
