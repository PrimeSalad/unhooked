import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

/** Subtle water-dot texture for brand surfaces (orange welcome, deep-water pause). */
export function DotPattern({ color = '#FFFFFF', opacity = 0.16, gap = 22 }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id={`dots-${gap}`} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <Circle cx={gap / 2} cy={gap / 2} r={1.6} fill={color} fillOpacity={opacity} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#dots-${gap})`} />
    </Svg>
  );
}
