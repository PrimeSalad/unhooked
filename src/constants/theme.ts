// Design tokens. Calm, non-alarming palette: Unhooked nudges, it never scolds.
// Use tokens everywhere; never hard-code colors or spacing in screens.

export const colors = {
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EFECE5',
  border: '#E2DED5',
  text: '#1F2421',
  textMuted: '#5F665F',
  primary: '#2F6F5E', // calm green — "intentional"
  primaryText: '#FFFFFF',
  accent: '#C98A3D', // warm amber — "pause"
  info: '#3D6FB4',
  warning: '#B7791F',
  danger: '#B4443D', // reserved for high-risk messages, never for user setbacks
  success: '#2F855A',
  // Module identity colors
  debt: '#7A5AA6',
  spend: '#C98A3D',
  scroll: '#3D8FA6',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const font = {
  size: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type ModuleKey = 'debt' | 'spend' | 'scroll';
