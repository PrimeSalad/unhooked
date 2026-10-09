// Ginto the goldfish. The dimensional body is derived from the original logo;
// lightweight SVG face and effect layers preserve moods without flattening the character.

import { useEffect, type ReactNode, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Image as SvgImage, Path } from 'react-native-svg';

import { fonts } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type GintoMood =
  'happy' | 'wave' | 'curious' | 'calm' | 'worried' | 'proud' | 'sleepy' | 'thinking' | 'brave';

type Extra = 'bubbles' | 'alert' | 'sweat' | 'splash' | 'zz' | 'think' | 'shield';

interface Traits {
  mouth: 'open' | 'o' | 'smile' | 'wavy' | 'big';
  body: 'bob' | 'breathe' | 'jump' | 'shiver' | 'sway';
  fin: 'pec' | 'wave';
  look?: [number, number];
  brow?: 'worried' | 'brave';
  extras: Extra[];
}

const MOODS: Record<GintoMood, Traits> = {
  happy: { mouth: 'open', body: 'bob', fin: 'pec', extras: ['bubbles'] },
  wave: { mouth: 'open', body: 'bob', fin: 'wave', extras: ['bubbles'] },
  curious: {
    look: [3, -3],
    mouth: 'o',
    body: 'bob',
    fin: 'pec',
    extras: ['alert', 'bubbles'],
  },
  calm: { mouth: 'smile', body: 'breathe', fin: 'pec', extras: ['bubbles'] },
  worried: {
    look: [-1, 1],
    brow: 'worried',
    mouth: 'wavy',
    body: 'shiver',
    fin: 'pec',
    extras: ['sweat'],
  },
  proud: { mouth: 'big', body: 'jump', fin: 'wave', extras: ['splash'] },
  sleepy: { mouth: 'o', body: 'sway', fin: 'pec', extras: ['zz'] },
  thinking: {
    look: [3, -4],
    mouth: 'smile',
    body: 'bob',
    fin: 'pec',
    extras: ['think'],
  },
  brave: {
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
const GINTO_BASE = require('../../../assets/ginto-base.png');
const GINTO_TAIL = require('../../../assets/ginto-tail.png');
const GINTO_DORSAL = require('../../../assets/ginto-dorsal.png');
const GINTO_FRONT_FIN = require('../../../assets/ginto-front-fin.png');
const GINTO_SIDE_FIN = require('../../../assets/ginto-side-fin.png');

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

  const tail = usePingPong(1100, on);
  const dorsal = usePingPong(2200, on);
  const side = usePingPong(1700, on);
  const fin = usePingPong(t.fin === 'wave' ? 900 : 1400, on);

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
      <View style={[StyleSheet.absoluteFill, { transform: [{ scale: 0.78 }] }]}>
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
                    rotate: shield.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '8deg'],
                    }),
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

          <Layer>
            <SvgImage
              href={GINTO_BASE}
              x={0}
              y={18}
              width={VB_W}
              height={164}
              preserveAspectRatio="xMidYMid meet"
            />
          </Layer>

          <Layer origin={pct(62, 102)} style={rot(tail, '0deg', '2.5deg')}>
            <SvgImage
              href={GINTO_TAIL}
              x={0}
              y={18}
              width={VB_W}
              height={164}
              preserveAspectRatio="xMidYMid meet"
            />
          </Layer>

          <Layer origin={pct(109, 66)} style={rot(dorsal, '0deg', '2deg')}>
            <SvgImage
              href={GINTO_DORSAL}
              x={0}
              y={18}
              width={VB_W}
              height={164}
              preserveAspectRatio="xMidYMid meet"
            />
          </Layer>

          <Layer origin={pct(193, 115)} style={rot(side, '0deg', '3deg')}>
            <SvgImage
              href={GINTO_SIDE_FIN}
              x={0}
              y={18}
              width={VB_W}
              height={164}
              preserveAspectRatio="xMidYMid meet"
            />
          </Layer>

          <Layer
            origin={pct(109, 132)}
            style={t.fin === 'wave' ? rot(fin, '0deg', '-10deg') : rot(fin, '0deg', '3deg')}
          >
            <SvgImage
              href={GINTO_FRONT_FIN}
              x={0}
              y={18}
              width={VB_W}
              height={164}
              preserveAspectRatio="xMidYMid meet"
            />
          </Layer>

          {/* The same round, dark eyes are visible in every mood. */}
          <Layer>
            <G transform={`translate(${lx} ${ly})`}>
              <Circle cx={137} cy={103} r={13} fill="#160A03" />
              <Circle cx={173} cy={95} r={11.5} fill="#160A03" />
              <Circle cx={141} cy={97} r={4.8} fill="#FFFDF4" />
              <Circle cx={176.5} cy={89.5} r={4.3} fill="#FFFDF4" />
              <Circle cx={132.5} cy={109} r={2} fill="#FFFDF4" opacity={0.7} />
              <Circle cx={169} cy={101} r={1.8} fill="#FFFDF4" opacity={0.7} />
            </G>
          </Layer>

          {/* Brows + mouth */}
          <Layer>
            {t.brow === 'worried' && (
              <Path d="M124 83 L147 77 M162 73 L182 79" {...line} strokeWidth={3} />
            )}
            {t.brow === 'brave' && (
              <Path d="M124 78 L147 85 M162 80 L182 72" {...line} strokeWidth={3} />
            )}
            {t.mouth === 'open' && (
              <G>
                <Path d="M154 119 Q163 136 173 117 Q164 121 154 119 Z" fill={mouthInk} />
                <Ellipse cx={164} cy={128} rx={4.6} ry={2.8} fill="#F07A6A" />
              </G>
            )}
            {t.mouth === 'o' && <Ellipse cx={164} cy={123} rx={4.7} ry={5.8} fill={mouthInk} />}
            {t.mouth === 'smile' && (
              <Path d="M156 120 Q164 129 173 118" {...line} stroke="#8A2A12" strokeWidth={2.8} />
            )}
            {t.mouth === 'wavy' && (
              <Path d="M155 124 q4.5 -4 9 0 t9 0" {...line} stroke="#8A2A12" strokeWidth={2.6} />
            )}
            {t.mouth === 'big' && (
              <G>
                <Path d="M151 116 Q164 144 178 114 Q165 120 151 116 Z" fill={mouthInk} />
                <Ellipse cx={164.5} cy={130} rx={6.2} ry={3.5} fill="#F07A6A" />
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
              <Path
                d="M190 60 C 196 70, 198 77, 192 81 C 186 84, 183 76, 190 60 Z"
                fill="#8FD3F0"
              />
            </Layer>
          )}
        </Animated.View>

        {has('alert') && (
          <Layer
            origin={pct(184, 50)}
            style={{
              opacity: alert.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  scale: alert.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.1, 1] }),
                },
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
                    translateY: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8 * k, -28 * k],
                    }),
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
                    {
                      translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -28 * k] }),
                    },
                    { rotate: '45deg' },
                  ],
                },
              ]}
            />
          ))}
      </View>
    </View>
  );
}

export const GINTO_ASPECT = VB_H / VB_W;
