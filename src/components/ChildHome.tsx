import { Ear } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { audio } from '../audio';
import { db } from '../db';

interface ChildHomeProps {
  onStart: () => void;
  onParent: () => void;
}

export default function ChildHome({ onStart, onParent }: ChildHomeProps) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayCompletedSessions = useLiveQuery(() => 
    db.sessions
      .where('startedAt')
      .aboveOrEqual(startOfToday.getTime())
      .filter(s => s.status === 'completed' || s.status === 'completed_short')
      .toArray()
  );

  const completedCount = todayCompletedSessions?.length || 0;

  const handleStart = async () => {
    await audio.init();
    onStart();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative select-none">
      {/* Single, clear Adult / Parent Gate access in the top-right corner */}
      <div className="absolute top-8 right-8 z-10">
        <button
          onClick={onParent}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-200/70 hover:bg-slate-200 active:bg-slate-300 text-slate-500 hover:text-slate-700 transition-colors shadow-2xs text-xs font-semibold"
          aria-label="Parent Area"
        >
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span>Parents</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
        <button
          onClick={handleStart}
          className="w-64 h-64 rounded-full bg-blue-600 shadow-xl flex flex-col items-center justify-center space-y-4 active:scale-95 transition-transform"
        >
          <Ear className="w-28 h-28 text-white" />
          <span className="text-white text-3xl font-bold tracking-wide">Practice</span>
        </button>

        {/* Real Daily Completion Marks (4 target sessions) */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex space-x-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div 
                key={i} 
                className={`w-6 h-6 rounded-full transition-colors ${
                  i <= completedCount ? 'bg-emerald-500 shadow-sm' : 'bg-slate-200'
                }`} 
              />
            ))}
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {completedCount} of 4 sessions today
          </span>
        </div>
      </div>
    </div>
  );
}
