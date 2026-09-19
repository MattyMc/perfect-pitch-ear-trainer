import { Ear, ChevronDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { audio } from '../audio';
import { completedSessionsTodayQuery, Profile } from '../db';
import ProfileDot from './ProfileDot';

interface ChildHomeProps {
  profile: Profile;
  onStart: () => void;
  onParent: () => void;
  onSwitchProfile: () => void;
}

export default function ChildHome({ profile, onStart, onParent, onSwitchProfile }: ChildHomeProps) {
  const todayCompletedSessions = useLiveQuery(
    () => completedSessionsTodayQuery(profile.id),
    [profile.id]
  );

  const completedCount = todayCompletedSessions?.length || 0;

  const handleStart = async () => {
    await audio.init();
    onStart();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative select-none">
      {/* Who is practicing — tap to switch profiles */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={onSwitchProfile}
          className="flex items-center space-x-1.5 pl-3 pr-2 py-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 transition-colors shadow-2xs text-sm font-bold max-w-[45vw]"
          aria-label={`Practicing as ${profile.name}. Switch profile`}
        >
          <ProfileDot colorHex={profile.colorHex} className="w-3 h-3 mr-2" />
          <span className="truncate">{profile.name}</span>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      </div>

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
