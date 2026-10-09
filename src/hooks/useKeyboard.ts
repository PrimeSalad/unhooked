// Android draws edge-to-edge (SDK 54+), so the window no longer resizes for the keyboard.
// KeyboardAvoidingView has to pad on both platforms; web needs nothing.

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export const keyboardBehavior = Platform.OS === 'web' ? undefined : ('padding' as const);

/** True while the on-screen keyboard is up, so bottom safe-area padding can be dropped. */
export function useKeyboardVisible(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setShown(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setShown(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}
