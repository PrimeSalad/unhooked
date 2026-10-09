import { Platform, useWindowDimensions } from 'react-native';

/** On web the app is rendered inside a phone-width frame (see PhoneFrame). */
export const PHONE_MAX_WIDTH = 430;

/** Width of the area the app actually draws in: the phone screen, or the web frame. */
export function useFrameWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, PHONE_MAX_WIDTH) : width;
}
