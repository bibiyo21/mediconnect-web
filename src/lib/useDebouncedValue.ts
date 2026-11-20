import { useEffect, useState } from 'react';

/** Search input debounce (CLAUDE.md §11.5: about 300 ms). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The value, once it has stopped changing for `delayMs`. Each change restarts
 * the timer, so typing "cardio" sends one request, not six.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
