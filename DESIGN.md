# Design

> Maintained with `frontend-god-mode`.
> Source of truth for typography, color, motion, layout, and mascot treatment.
> Read this before changing the UI.

## Aesthetic direction

Playful soft-3D companion: warm Filipino goldfish character, tactile rounded surfaces, calm financial guidance, and deep-water moments that never feel punitive.

## Dials

- DESIGN_VARIANCE: 7 / 10
- MOTION_INTENSITY: 6 / 10
- VISUAL_DENSITY: 4 / 10

## Type stack

- Display and body: Poppins, weights 400–800
- Loaded through: `@expo-google-fonts/poppins`
- Display tracking is tightened; body copy uses at least 1.5 line height
- Maximum reading width: 65 characters

## Color tokens

- Cream background: `#FFF6EC`
- Ink: `#2A1608`
- Goldfish: `#FF6B1A`
- Ember: `#C4450B`
- Peach: `#FFE3CC`
- Amber: `#FFB061`
- Deep water: `#0B3440`
- Lagoon: `#0F5F6E`
- Shell: `#DDF0F3`
- Alert only: `#B3261E`

Banned: purple-to-blue gradients, pure black, cold gray shadows, and using red for ordinary setbacks.

## Mascot

- Ginto must match the original logo's soft 3D toy finish.
- Silhouette: round head-dominant body, split tail, upright dorsal fin, two rounded pectoral fins.
- Surface: warm gold gradient, layered tail-side scales, soft highlights; never a flat orange oval.
- Face remains an animated overlay so all nine moods stay readable at small sizes.
- One Ginto per screen. Ginto accompanies and reacts; Ginto never scolds.
- Hook is the only sharp visual element.

## Motion

- Ginto bob: 3.2 seconds, restrained vertical drift and rotation
- Pause breath: 4 seconds in and 4 seconds out
- Hook: 900 ms drop or yank with controlled overshoot
- Screen rise: 450 ms over 14 px
- Animate transforms and opacity only
- Every loop cleans up and respects reduced-motion settings

## Layout and components

- Mobile-first Expo/React Native layout
- Minimum touch target: 44×44 px
- Pills: 52 px minimum height
- Cards use warm tinted borders and shadows
- Avoid nested cards, generic three-card rows, and decorative clutter

## Accessibility floor

- WCAG AA contrast for body copy
- Reduced motion supported everywhere
- Mascot is decorative and hidden from the accessibility tree
- Meaning is never conveyed by mascot expression alone

## Last updated

2026-10-09 — Rebuilt Ginto around a logo-faithful soft-3D master body while preserving animated moods.
