import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';

interface ParentGateProps {
  onCancel: () => void;
  children: React.ReactNode;
}

export default function ParentGate({ onCancel, children }: ParentGateProps) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Parent hold is 1 second
  const HOLD_TIME = 1000;

  const startHold = () => {
    startTimeRef.current = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min((elapsed / HOLD_TIME) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        setIsUnlocked(true);
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
    if (!isUnlocked) {
      setProgress(0);
    }
  };

  useEffect(() => {
    return () => stopHold();
  }, [isUnlocked]);

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Prominent Large Return Button at the top if tapped by accident (Primary Color) */}
      <div className="p-4 pt-10">
        <button 
          onClick={onCancel}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl flex items-center justify-center space-x-3 text-white font-bold text-lg shadow-lg active:scale-[0.99] transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
          <span>Back to Child Practice</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8 p-6 text-center max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 shadow-inner">
          <Shield className="w-10 h-10" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold mb-2">Adult Gate</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Press and hold the button below for <strong className="text-white">1 second</strong> to access parent guidance, curriculum, and analytics.
          </p>
        </div>

        <button
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onContextMenu={e => e.preventDefault()}
          className="relative w-40 h-40 rounded-full bg-slate-800 overflow-hidden shadow-2xl border-2 border-slate-700 active:scale-95 transition-transform touch-none"
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-none"
            style={{ height: `${progress}%` }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-bold text-xl relative z-10 text-white">Hold</span>
            <span className="text-xs text-slate-400 relative z-10 mt-1">1 second</span>
          </div>
        </button>
      </div>
    </div>
  );
}
