import { useEffect, useRef, useState } from 'react';

/**
 * Press-and-hold for `holdMs`, shared by `ParentGate` and `HoldToExit`.
 *
 * Completion runs on a timer; animation frames only draw the progress fill. A hidden tab runs
 * no frames at all, so a hold that completed from inside the frame loop never finished there
 * — which stalled automated browser testing whenever the window was in the background.
 */
export function useHold(holdMs: number, onComplete: () => void) {
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimers = () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    timeoutRef.current = null;
    frameRef.current = null;
  };

  const start = () => {
    clearTimers();
    const startedAt = performance.now();
    const draw = () => {
      setProgress(Math.min(((performance.now() - startedAt) / holdMs) * 100, 100));
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setProgress(100);
      onCompleteRef.current();
    }, holdMs);
  };

  const cancel = () => {
    // After completion there is nothing pending; leave the fill full rather than flash it empty.
    if (timeoutRef.current === null) return;
    clearTimers();
    setProgress(0);
  };

  useEffect(() => clearTimers, []);

  return { progress, start, cancel };
}
