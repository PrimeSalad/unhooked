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

function GintoDefs() {
  return (
    <Defs>
      <LinearGradient id="gintoFin" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE58B" />
        <Stop offset="0.42" stopColor="#FFB52F" />
        <Stop offset="1" stopColor="#F36A0A" />
      </LinearGradient>
      <RadialGradient id="gintoBody" cx="68%" cy="35%" r="76%">
        <Stop offset="0" stopColor="#FFF0A6" />
        <Stop offset="0.34" stopColor="#FFC23F" />
        <Stop offset="0.7" stopColor="#FF8B13" />
        <Stop offset="1" stopColor="#E95705" />
      </RadialGradient>
      <LinearGradient id="gintoBelly" x1="0" y1="0" x2="0.85" y2="1">
        <Stop offset="0" stopColor="#FFF7C8" stopOpacity={0.82} />
        <Stop offset="1" stopColor="#FFD76A" stopOpacity={0.08} />
      </LinearGradient>
      <LinearGradient id="gintoScale" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFD64F" />
        <Stop offset="1" stopColor="#FF790D" />
      </LinearGradient>
      <RadialGradient id="gintoEye" cx="36%" cy="28%" r="72%">
        <Stop offset="0" stopColor="#5B3A20" />
        <Stop offset="0.34" stopColor="#241207" />
        <Stop offset="1" stopColor="#0E0703" />
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
          <GintoDefs />
          <Path
            d="M72 112 C55 89 30 69 13 76 C3 80 6 94 15 103 C22 111 29 113 38 113 C27 118 17 129 14 140 C11 152 22 158 35 152 C54 143 65 128 72 112 Z"
            fill="url(#gintoFin)"
          />
          <Path
            d="M65 108 C51 96 37 86 21 83 M65 111 C48 106 34 102 16 101 M65 115 C47 120 31 128 19 142 M65 117 C53 130 44 141 34 149"
            {...ray}
          />
        </Layer>

        <Layer origin={pct(112, 64)} style={rot(dorsal, '0deg', '-7deg')}>
          <GintoDefs />
          <Path
            d="M88 69 C88 43 106 23 127 28 C145 32 154 49 149 66 C130 59 108 60 88 69 Z"
            fill="url(#gintoFin)"
          />
          <Path
            d="M99 64 C100 52 105 40 110 33 M115 61 C119 48 126 37 132 32 M131 62 C138 53 143 46 146 42"
            {...ray}
          />
        </Layer>

        <Layer origin={pct(170, 112)} style={rot(side, '0deg', '14deg')}>
          <GintoDefs />
          <Path
            d="M174 108 C196 100 208 117 201 132 C196 143 184 146 177 136 C171 128 170 117 174 108 Z"
            fill="url(#gintoFin)"
          />
          <Path d="M180 113 C188 116 194 123 198 132 M178 120 C185 126 189 133 190 140" {...ray} />
        </Layer>

        <Layer>
          <GintoDefs />
          <Path
            d="M57 111 C58 81 76 59 105 53 C139 45 177 57 193 82 C210 109 198 143 171 158 C144 173 102 169 77 150 C63 139 56 126 57 111 Z"
            fill="url(#gintoBody)"
          />
          {/* Layered scales keep the silhouette unmistakably fish-like at small sizes. */}
          <Path
            d="M64 95 C73 84 87 82 97 91 C94 101 83 108 69 107 Z M61 113 C72 102 87 102 96 112 C91 122 78 127 64 124 Z M68 132 C79 122 93 123 101 133 C95 143 84 147 74 143 Z"
            fill="url(#gintoScale)"
            opacity={0.72}
          />
          <Path
            d="M84 78 C94 69 108 69 117 78 C113 89 103 95 90 93 Z M88 99 C99 88 114 89 122 99 C117 110 105 115 93 111 Z M91 121 C102 110 117 111 125 121 C120 132 108 137 96 133 Z M88 143 C98 134 112 135 119 145 C113 153 102 157 93 153 Z"
            fill="#FF9818"
            opacity={0.55}
          />
          <Path
            d="M111 153 C136 164 171 151 188 127 C181 151 156 166 128 168 C121 166 115 160 111 153 Z"
            fill="url(#gintoBelly)"
          />
          <Path
            d="M115 78 C108 92 108 111 117 127"
            stroke="#E96A0B"
            strokeWidth={2.2}
            strokeLinecap="round"
            opacity={0.34}
            fill="none"
          />
          <Ellipse
            cx={146}
            cy={69}
            rx={29}
            ry={10}
            transform="rotate(-12 146 69)"
            fill="#FFFFFF"
            opacity={0.34}
          />
          <Ellipse cx={129} cy={128} rx={8} ry={4.5} fill="#FF6555" opacity={0.26} />
          <Ellipse cx={184} cy={119} rx={6.5} ry={3.8} fill="#FF6555" opacity={0.27} />
        </Layer>

        <Layer
          origin={pct(110, 140)}
          style={t.fin === 'wave' ? rot(fin, '-8deg', '-58deg') : rot(fin, '0deg', '16deg')}
        >
          <GintoDefs />
          <Path
            d="M111 135 C93 148 88 168 102 178 C116 187 137 176 141 158 C138 147 127 139 111 135 Z"
            fill="url(#gintoFin)"
          />
          <Path
            d="M114 141 C107 152 103 164 104 176 M122 143 C119 155 120 169 116 179 M130 147 C132 156 131 166 128 174"
            {...ray}
          />
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
              <GintoDefs />
              <Ellipse cx={137} cy={103} rx={13} ry={15} fill="url(#gintoEye)" />
              <Circle cx={141} cy={97} r={4.8} fill="#FFFFFF" />
              <Circle cx={132.5} cy={109} r={2} fill="#FFFFFF" opacity={0.7} />
              <Ellipse cx={173} cy={95} rx={11.5} ry={14} fill="url(#gintoEye)" />
              <Circle cx={176.5} cy={89.5} r={4.3} fill="#FFFFFF" />
              <Circle cx={169} cy={101} r={1.8} fill="#FFFFFF" opacity={0.7} />
            </G>
          </Layer>
        ) : (
          <Layer>
            {t.eyes === 'sleepy' && (
              <G>
                <Ellipse cx={137} cy={105} rx={13} ry={11} fill="#1C0E05" />
                <Ellipse cx={173} cy={97} rx={11.5} ry={10} fill="#1C0E05" />
                <Path d="M123 105 A 14 13 0 0 1 151 105 Z" fill="#FFAA32" />
                <Path d="M160.5 97 A 12.5 12 0 0 1 185.5 97 Z" fill="#FFB23B" />
                <Path d="M123 105 H151 M160.5 97 H185.5" {...line} strokeWidth={2.6} />
              </G>
            )}
            {t.eyes === 'happy' && (
              <Path d="M123 107 Q137 90 151 107 M161 100 Q173 85 185 100" {...line} />
            )}
            {t.eyes === 'calm' && (
              <Path d="M123 103 Q137 114 151 103 M161 96 Q173 106 185 96" {...line} />
            )}
          </Layer>
        )}

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
