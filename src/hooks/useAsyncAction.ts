import { useRef, useState } from 'react';

/** Prevent duplicate submissions and keep failures visible without discarding the user's draft. */
export function useAsyncAction(failure = 'Could not save this change. Your details are still here. Please try again.') {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      console.warn(failure, cause);
      setError(failure);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return { run, pending, error, clearError: () => setError(null) };
}
