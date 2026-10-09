// Ginto the goldfish. Ported from prototype/project/Mascot.dc.html.
// The fish is split into stacked SVG layers so each part (tail, fins, eyes, body)
// can animate on the native driver with its own transformOrigin.

import { useEffect, type ReactNode, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { fonts } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type GintoMood =
  'happy' | 'wave' | 'curious' | 'calm' | 'worried' | 'proud' | 'sleepy' | 'thinking' | 'brave';

type Extra = 'bubbles' | 'alert' | 'sweat' | 'splash' | 'zz' | 'think' | 'shield';

interface Traits {
  eyes: 'open' | 'happy' | 'calm' | 'sleepy';
  mouth: 'open' | 'o' | 'smile' | 'wavy' | 'big';
  body: 'bob' | 'breathe' | 'jump' | 'shiver' | 'sway';
  fin: 'pec' | 'wave';
  look?: [number, number];
  brow?: 'worried' | 'brave';
  extras: Extra[];
}

const MOODS: Record<GintoMood, Traits> = {
  happy: { eyes: 'open', mouth: 'open', body: 'bob', fin: 'pec', extras: ['bubbles'] },
  wave: { eyes: 'happy', mouth: 'open', body: 'bob', fin: 'wave', extras: ['bubbles'] },
  curious: {
    eyes: 'open',
    look: [3, -3],
    mouth: 'o',
    body: 'bob',
    fin: 'pec',
    extras: ['alert', 'bubbles'],
  },
  calm: { eyes: 'calm', mouth: 'smile', body: 'breathe', fin: 'pec', extras: ['bubbles'] },
  worried: {
    eyes: 'open',
    look: [-1, 1],
    brow: 'worried',
    mouth: 'wavy',
    body: 'shiver',
    fin: 'pec',
    extras: ['sweat'],
  },
  proud: { eyes: 'happy', mouth: 'big', body: 'jump', fin: 'wave', extras: ['splash'] },
  sleepy: { eyes: 'sleepy', mouth: 'o', body: 'sway', fin: 'pec', extras: ['zz'] },
  thinking: {
    eyes: 'open',
    look: [3, -4],
    mouth: 'smile',
    body: 'bob',
    fin: 'pec',
    extras: ['think'],
  },
  brave: {
    eyes: 'open',
    brow: 'brave',
    mouth: 'smile',
    body: 'bob',
    fin: 'pec',
    extras: ['shield'],
  },
};

const VB_W = 220;
const VB_H = 200;
const ink = '#2A1608';
const mouthInk = '#8A1F12';

// ---------- animation helpers ----------

/** 0 → 1 → 0 forever (ping-pong). */
function usePingPong(ms: number, active: boolean, delay = 0) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const ease = Easing.inOut(Easing.sin);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: ms / 2, easing: ease, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: ms / 2, easing: ease, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, delay, ms, v]);
  return v;
}

/** 0 → 1 then restart, forever (one-way cycle). */
function useCycle(ms: number, active: boolean, delay = 0, easing = Easing.linear) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: ms, easing, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, delay, easing, ms, v]);
  return v;
}

function useBlink(active: boolean) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    v.setValue(0);
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(4200),
        Animated.timing(v, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 130, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, v]);
  return v;
}

const pct = (x: number, y: number) =>
  `${((x / VB_W) * 100).toFixed(1)}% ${((y / VB_H) * 100).toFixed(1)}%`;

function Layer({
  origin,
  style,
  children,
}: {
  origin?: string;
  style?: Animated.WithAnimatedValue<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, origin ? { transformOrigin: origin } : null, style]}
    >
      <Svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%">
        {children}
      </Svg>
    </Animated.View>
  );
}

function FinGradient() {
  return (
    <Defs>
      <LinearGradient id="gintoFin" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFCB7E" />
        <Stop offset="1" stopColor="#FF8A1F" />
      </LinearGradient>
      <RadialGradient id="gintoBody" cx="62%" cy="30%" r="78%">
        <Stop offset="0" stopColor="#FFD992" />
        <Stop offset="0.45" stopColor="#FFA63D" />
        <Stop offset="0.8" stopColor="#FF8214" />
        <Stop offset="1" stopColor="#EC6206" />
      </RadialGradient>
    </Defs>
  );
}

const ray = {
  stroke: '#FFE1B8',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  opacity: 0.75,
  fill: 'none',
};
const line = {
  stroke: ink,
  strokeWidth: 3.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

// ---------- component ----------

export interface GintoProps {
  mood?: GintoMood;
  size?: number;
  style?: ViewStyle;
}

export function Ginto({ mood = 'happy', size = 120, style }: GintoProps) {
  const t = MOODS[mood];
  const reduced = useReducedMotion();
  const on = !reduced;
  const k = size / VB_W;
  const has = (e: Extra) => t.extras.includes(e);

  // Body-level motion
  const bob = usePingPong(3200, on && t.body === 'bob');
  const breathe = usePingPong(8000, on && t.body === 'breathe');
  const jump = useCycle(1600, on && t.body === 'jump');
  const shiver = useCycle(2400, on && t.body === 'shiver');
  const sway = usePingPong(5000, on && t.body === 'sway');

  // Parts
  const tail = usePingPong(1100, on);
  const dorsal = usePingPong(2200, on);
  const side = usePingPong(1700, on);
  const fin = usePingPong(t.fin === 'wave' ? 900 : 1400, on);
  const blink = useBlink(on && t.eyes === 'open');

  // Extras
  const b1 = useCycle(3600, on && has('bubbles'), 0, Easing.in(Easing.quad));
  const b2 = useCycle(3600, on && has('bubbles'), 1200, Easing.in(Easing.quad));
  const b3 = useCycle(3600, on && has('bubbles'), 2300, Easing.in(Easing.quad));
  const alert = useCycle(1300, on && has('alert'), 0, Easing.out(Easing.quad));
  const sweat = useCycle(2400, on && has('sweat'), 0, Easing.in(Easing.quad));
  const shield = usePingPong(3000, on && has('shield'));
  const z1 = useCycle(3000, on && has('zz'), 0, Easing.out(Easing.quad));
  const z2 = useCycle(3000, on && has('zz'), 1000, Easing.out(Easing.quad));
  const z3 = useCycle(3000, on && has('zz'), 2000, Easing.out(Easing.quad));
  const th1 = usePingPong(2400, on && has('think'));
  const th2 = usePingPong(2400, on && has('think'), 300);
  const th3 = usePingPong(2400, on && has('think'), 600);
  const s1 = useCycle(1600, on && has('splash'), 0, Easing.out(Easing.quad));
  const s2 = useCycle(1600, on && has('splash'), 250, Easing.out(Easing.quad));
  const s3 = useCycle(1600, on && has('splash'), 500, Easing.out(Easing.quad));

  const bodyTransform = (() => {
    switch (t.body) {
      case 'breathe':
        return [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.07] }) }];
      case 'jump':
        return [
          {
            translateY: jump.interpolate({
              inputRange: [0, 0.12, 0.4, 0.62, 0.86, 1],
              outputRange: [0, 4 * k, -30 * k, -34 * k, 0, 0],
            }),
          },
          {
            rotate: jump.interpolate({
              inputRange: [0, 0.4, 0.62, 0.86, 1],
              outputRange: ['0deg', '-12deg', '8deg', '0deg', '0deg'],
            }),
          },
          {
            scaleY: jump.interpolate({
              inputRange: [0, 0.12, 0.4, 0.86, 0.93, 1],
              outputRange: [1, 0.9, 1.06, 0.94, 1, 1],
            }),
          },
        ];
      case 'shiver':
        return [
          {
            translateX: shiver.interpolate({
              inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
              outputRange: [0, -1.6 * k, 1.6 * k, -1.6 * k, 1.6 * k, 0, 0],
            }),
          },
        ];
      case 'sway':
        return [
          { translateY: sway.interpolate({ inputRange: [0, 1], outputRange: [0, 5 * k] }) },
          { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '3deg'] }) },
        ];
      default:
        return [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6 * k] }) },
          { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2deg'] }) },
        ];
    }
  })();

  const rot = (v: Animated.Value, a: string, b: string) => ({
    transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: [a, b] }) }],
  });

  const [lx, ly] = t.look ?? [0, 0];
  const height = (size * VB_H) / VB_W;

  const rise = (v: Animated.Value, from: number, to: number) => ({
    opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.95, 0] }),
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from * k, to * k] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.05] }) },
    ],
  });

  const dot = (x: number, y: number, r: number): ViewStyle => ({
    position: 'absolute',
    left: (x - r) * k,
    top: (y - r) * k,
    width: r * 2 * k,
    height: r * 2 * k,
    borderRadius: r * k,
  });

  return (
    <View
      pointerEvents="none"
      style={[{ width: size, height }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {has('bubbles') &&
        (
          [
            [b1, 78, 40, 9],
            [b2, 64, 58, 6],
            [b3, 88, 22, 4.5],
          ] as const
        ).map(([v, x, y, r], i) => (
          <Animated.View
            key={i}
            style={[
              dot(x, y, r),
              {
                backgroundColor: 'rgba(255,231,199,0.55)',
                borderWidth: 2 * k,
                borderColor: '#FFAA55',
              },
              rise(v, 18, -44),
            ]}
          />
        ))}

      <Animated.View style={[StyleSheet.absoluteFill, { transform: bodyTransform }]}>
        {has('shield') && (
          <Layer
            origin={pct(116, 108)}
            style={{
              opacity: shield.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
              transform: [
                {
                  rotate: shield.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] }),
                },
                { scale: shield.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.02] }) },
              ],
            }}
          >
            <Circle
              cx={116}
              cy={108}
              r={92}
              fill="#7CC8E8"
              fillOpacity={0.13}
              stroke="#4FA9CF"
              strokeWidth={3}
              strokeDasharray="12 9"
            />
          </Layer>
        )}

        <Layer origin={pct(68, 112)} style={rot(tail, '-10deg', '10deg')}>
          <FinGradient />
          <Path
            d="M68 112 C 50 84, 20 66, 12 90 C 8 104, 22 110, 32 112 C 22 114, 8 122, 14 136 C 22 158, 50 140, 68 112 Z"
            fill="url(#gintoFin)"
          />
          <Path d="M62 110 L24 86 M62 111 L18 100 M62 114 L18 126 M62 115 L26 140" {...ray} />
        </Layer>

        <Layer origin={pct(112, 64)} style={rot(dorsal, '0deg', '-7deg')}>
          <FinGradient />
          <Path
            d="M86 66 C 84 38, 108 22, 132 30 C 148 36, 152 50, 146 64 Z"
            fill="url(#gintoFin)"
          />
          <Path d="M100 62 L104 36 M114 60 L124 34 M128 60 L140 42" {...ray} />
        </Layer>

        <Layer origin={pct(170, 112)} style={rot(side, '0deg', '14deg')}>
          <FinGradient />
          <Path
            d="M170 104 C 192 94, 204 118, 186 130 C 178 134, 170 126, 170 118 Z"
            fill="url(#gintoFin)"
          />
        </Layer>

        <Layer>
          <FinGradient />
          <Ellipse
            cx={118}
            cy={110}
            rx={62}
            ry={56}
            transform="rotate(-10 118 110)"
            fill="url(#gintoBody)"
          />
          <Path
            d="M66 104 a9 9 0 0 0 18 0 M70 124 a9 9 0 0 0 18 0 M80 86 a9 9 0 0 0 18 0 M84 106 a9 9 0 0 0 18 0 M88 126 a9 9 0 0 0 18 0 M78 144 a9 9 0 0 0 18 0"
            stroke="#E86A0C"
            strokeWidth={2.4}
            strokeLinecap="round"
            opacity={0.4}
            fill="none"
          />
          <Ellipse cx={146} cy={132} rx={30} ry={19} fill="#FFE3B4" opacity={0.32} />
          <Ellipse
            cx={130}
            cy={74}
            rx={24}
            ry={9}
            transform="rotate(-16 130 74)"
            fill="#FFFFFF"
            opacity={0.38}
          />
          <Ellipse cx={118} cy={122} rx={7} ry={4} fill="#FF5E5E" opacity={0.32} />
          <Ellipse cx={176} cy={114} rx={6} ry={3.6} fill="#FF5E5E" opacity={0.32} />
        </Layer>

        <Layer
          origin={pct(110, 140)}
          style={t.fin === 'wave' ? rot(fin, '-8deg', '-58deg') : rot(fin, '0deg', '16deg')}
        >
          <FinGradient />
          <Path
            d="M104 138 C 92 160, 104 180, 126 174 C 140 170, 140 152, 128 140 Z"
            fill="url(#gintoFin)"
          />
          <Path d="M110 142 L106 166 M118 142 L120 170 M124 144 L132 164" {...ray} />
        </Layer>

        {/* Eyes */}
        {t.eyes === 'open' ? (
          <Layer
            origin={pct(147, 100)}
            style={{
              transform: [
                { scaleY: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.08] }) },
              ],
            }}
          >
            <G transform={`translate(${lx} ${ly})`}>
              <Ellipse cx={130} cy={104} rx={11} ry={12.5} fill="#1C0E05" />
              <Circle cx={134} cy={99} r={4} fill="#FFFFFF" />
              <Circle cx={126.5} cy={109} r={1.8} fill="#FFFFFF" />
              <Ellipse cx={164} cy={97} rx={10.5} ry={12} fill="#1C0E05" />
              <Circle cx={168} cy={92} r={3.8} fill="#FFFFFF" />
              <Circle cx={160.5} cy={102} r={1.7} fill="#FFFFFF" />
            </G>
          </Layer>
        ) : (
          <Layer>
            {t.eyes === 'sleepy' && (
              <G>
                <Ellipse cx={130} cy={106} rx={11} ry={10} fill="#1C0E05" />
                <Ellipse cx={164} cy={99} rx={10.5} ry={9.5} fill="#1C0E05" />
                <Path d="M118 106 A 12 12 0 0 1 142 106 Z" fill="#FFA43C" />
                <Path d="M152.5 99 A 11.5 11.5 0 0 1 175.5 99 Z" fill="#FFA43C" />
                <Path d="M118 106 H142 M152.5 99 H175.5" {...line} strokeWidth={2.6} />
              </G>
            )}
            {t.eyes === 'happy' && (
              <Path d="M120 107 Q130 94 140 107 M154 100 Q164 87 174 100" {...line} />
            )}
            {t.eyes === 'calm' && (
              <Path d="M120 103 Q130 112 140 103 M154 96 Q164 105 174 96" {...line} />
            )}
          </Layer>
        )}

        {/* Brows + mouth */}
        <Layer>
          {t.brow === 'worried' && (
            <Path d="M119 86 L137 80 M157 74 L173 80" {...line} strokeWidth={3} />
          )}
          {t.brow === 'brave' && (
            <Path d="M119 80 L137 87 M157 81 L173 74" {...line} strokeWidth={3} />
          )}
          {t.mouth === 'open' && (
            <G>
              <Path d="M140 118 Q148 134 157 117 Z" fill={mouthInk} />
              <Ellipse cx={148.5} cy={125.5} rx={4.2} ry={2.6} fill="#F07A6A" />
            </G>
          )}
          {t.mouth === 'o' && <Ellipse cx={148} cy={122} rx={4.2} ry={5.2} fill={mouthInk} />}
          {t.mouth === 'smile' && (
            <Path d="M141 120 Q148 127 155 119" {...line} stroke="#8A2A12" strokeWidth={2.8} />
          )}
          {t.mouth === 'wavy' && (
            <Path d="M140 124 q4 -4 8 0 t8 0" {...line} stroke="#8A2A12" strokeWidth={2.6} />
          )}
          {t.mouth === 'big' && (
            <G>
              <Path d="M136 116 Q148 142 161 115 Z" fill={mouthInk} />
              <Ellipse cx={148.5} cy={128} rx={6} ry={3.4} fill="#F07A6A" />
            </G>
          )}
        </Layer>

        {has('sweat') && (
          <Layer
            style={{
              opacity: sweat.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1, 0] }),
              transform: [
                {
                  translateY: sweat.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0, 0, 24 * k],
                  }),
                },
              ],
            }}
          >
            <Path d="M190 60 C 196 70, 198 77, 192 81 C 186 84, 183 76, 190 60 Z" fill="#8FD3F0" />
          </Layer>
        )}
      </Animated.View>

      {has('alert') && (
        <Layer
          origin={pct(184, 50)}
          style={{
            opacity: alert.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: alert.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.1, 1] }) },
            ],
          }}
        >
          <Path
            d="M184 44 L178 30 M195 40 L199 25 M203 52 L216 47"
            stroke="#FFB020"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
        </Layer>
      )}

      {has('think') &&
        (
          [
            [th1, 190, 56, 4.5],
            [th2, 201, 40, 6.5],
            [th3, 214, 20, 9.5],
          ] as const
        ).map(([v, x, y, r], i) => (
          <Animated.View
            key={i}
            style={[
              dot(x, y, r),
              {
                backgroundColor: '#FFC793',
                opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                transform: [
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
                ],
              },
            ]}
          />
        ))}

      {has('zz') &&
        (
          [
            [z1, 184, 44, 18],
            [z2, 194, 26, 22],
            [z3, 206, 6, 26],
          ] as const
        ).map(([v, x, y, fs], i) => (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              left: x * k,
              top: y * k,
              fontFamily: fonts.extrabold,
              fontSize: fs * k,
              color: '#4FA9CF',
              opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 16 * k] }) },
                {
                  translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8 * k, -28 * k] }),
                },
              ],
            }}
          >
            z
          </Animated.Text>
        ))}

      {has('splash') &&
        (
          [
            [s1, 74, 178],
            [s2, 164, 178],
            [s3, 120, 184],
          ] as const
        ).map(([v, x, y], i) => (
          <Animated.View
            key={i}
            style={[
              dot(x, y, 5),
              {
                backgroundColor: '#FFE1B8',
                borderTopLeftRadius: 2 * k,
                opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -28 * k] }) },
                  { rotate: '45deg' },
                ],
              },
            ]}
          />
        ))}
    </View>
  );
}

export const GINTO_ASPECT = VB_H / VB_W;
