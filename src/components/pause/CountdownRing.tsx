import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/constants/theme';

/** Ring that fills smoothly over `seconds`. Children render centered inside. */
export function CountdownRing({
  seconds,
  size = 244,
  stroke = 6,
  track = 'rgba(255,246,236,0.12)',
  children,
}: {
  seconds: number;
  size?: number;
  stroke?: number;
  /** Unfilled ring color; the default suits the dark pause screen. */
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [progress] = useState(() => new Animated.Value(0));
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    // A listener instead of an animated SVG prop: works the same on native and web.
    const id = progress.addListener(({ value }) => setFilled(value));
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: seconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
      progress.removeListener(id);
    };
  }, [progress, seconds]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}
      >
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - filled)}
        />
      </Svg>
      {children}
    </View>
  );
}
