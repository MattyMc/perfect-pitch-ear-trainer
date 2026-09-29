import { DoorOpen } from 'lucide-react';
import { useHold } from './useHold';

export default function HoldToExit({ onExit }: { onExit: () => void }) {
  const { progress, start: startHold, cancel: stopHold } = useHold(1000, onExit);

  return (
    <button
      aria-label="Hold to exit"
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
