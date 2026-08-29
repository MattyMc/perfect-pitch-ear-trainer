import React, { useState, useRef, useEffect } from 'react';
import { DoorOpen } from 'lucide-react';

export default function HoldToExit({ onExit }: { onExit: () => void }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const HOLD_TIME = 1000;

  const startHold = () => {
    startTimeRef.current = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min((elapsed / HOLD_TIME) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        onExit();
      } else {
        timerRef.current = requestAnimationFrame(updateProgress);
      }
    };
    timerRef.current = requestAnimationFrame(updateProgress);
  };

  const stopHold = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);
  };

  useEffect(() => {
    return () => stopHold();
  }, []);

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onContextMenu={e => e.preventDefault()}
      className="relative w-12 h-12 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 overflow-hidden touch-none"
    >
      <div 
        className="absolute bottom-0 left-0 right-0 bg-slate-400 transition-none"
        style={{ height: `${progress}%` }}
      />
      <DoorOpen className="w-6 h-6 relative z-10" />
    </button>
  );
}
