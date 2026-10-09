// The hook: drops in when a risky decision starts, gets yanked away when the user chooses well.

import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { motion } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const LINE = 900; // the line runs far above the screen edge
const HOOK_W = 44;
const HOOK_H = 64;
const HIDDEN = -HOOK_H - 40;

export interface HookProps {
  /** Left edge of the hook in the parent's coordinates. */
  x: number;
  /** Where the hook's top rests in the parent's coordinates. */
  y: number;
  /** false = yanked up out of view. */
  shown: boolean;
  lineColor?: string;
  hookColor?: string;
}

export function Hook({ x, y, shown, lineColor = '#FFD9A8', hookColor = '#172033' }: HookProps) {
  const reduced = useReducedMotion();
  const pos = useState(() => new Animated.Value(HIDDEN))[0];
  const sway = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    const anim = Animated.timing(pos, {
      toValue: shown ? y : HIDDEN,
      duration: reduced ? 0 : motion.hook,
      easing: Easing.bezier(0.5, -0.35, 0.3, 1.25),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [pos, reduced, shown, y]);

  useEffect(() => {
    if (reduced) return;
    const ease = Easing.inOut(Easing.sin);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1800, easing: ease, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1800, easing: ease, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, sway]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: -LINE,
        width: HOOK_W,
        height: LINE + HOOK_H,
        transformOrigin: '50% 0%',
        transform: [
          { translateY: pos },
          { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.2deg'] }) },
        ],
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: HOOK_W / 2 - 1,
          top: 0,
          width: 2,
          height: LINE + 4,
          backgroundColor: lineColor,
        }}
      />
      <Svg
        width={HOOK_W}
        height={HOOK_H}
        viewBox="0 0 44 64"
        style={{ position: 'absolute', left: 0, top: LINE }}
      >
        <Circle cx={22} cy={6} r={4.5} fill="none" stroke={hookColor} strokeWidth={3} />
        <Path
          d="M22 11 V42 C22 56 6 58 6 44"
          fill="none"
          stroke={hookColor}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path d="M6 46 L3 34 L11 41 Z" fill={hookColor} />
        <Path
          d="M17.5 14 H26.5 M17.5 18 H26.5 M17.5 22 H26.5"
          stroke="#FF6B2C"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
