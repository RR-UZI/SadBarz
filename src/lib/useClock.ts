import { useCallback, useEffect, useRef, useState } from 'react';

// A pausable clock based on real timestamps, so it never drifts
// even if the screen lags or the tab sleeps for a moment.
export function useClock(tickMs = 100) {
  const [running, setRunning] = useState(false);
  const acc = useRef(0);
  const since = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((x) => x + 1), tickMs);
    return () => clearInterval(id);
  }, [running, tickMs]);

  const elapsedMs = acc.current + (running ? Date.now() - since.current : 0);

  const start = useCallback(() => {
    since.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (!running) return;
    acc.current += Date.now() - since.current;
    setRunning(false);
  }, [running]);

  const reset = useCallback((ms = 0, keepRunning = false) => {
    acc.current = ms;
    since.current = Date.now();
    setRunning(keepRunning);
    force((x) => x + 1);
  }, []);

  return { elapsedMs, running, start, pause, reset };
}
