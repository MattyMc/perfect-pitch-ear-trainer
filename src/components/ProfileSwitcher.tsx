import { useState } from 'react';
import { Check, Plus, ArrowLeft } from 'lucide-react';
import { Profile, setActiveProfile, suggestProfileColour } from '../db';
import ProfileCreateScreen from './ProfileCreateScreen';
import ProfileDot from './ProfileDot';

interface ProfileSwitcherProps {
  profiles: Profile[];
  /** Null when there is no active profile to return to, which hides the back button. */
  activeProfileId: string | null;
  onDone: () => void;
}

/** Full-screen "who's practicing?" picker opened from the child home screen. */
export default function ProfileSwitcher({ profiles, activeProfileId, onDone }: ProfileSwitcherProps) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <ProfileCreateScreen
        initialColor={suggestProfileColour(profiles)}
        onCreated={onDone}
        onCancel={() => setAdding(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none overflow-y-auto">
      <div className="flex items-center p-4 pt-8">
        {activeProfileId !== null ? (
          <button
            onClick={onDone}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : <div className="h-9" />}
      </div>

      <div className="flex-1 flex flex-col p-6 pt-2 max-w-md mx-auto w-full space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 text-center">Who is practicing?</h1>

        <div className="space-y-3">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                onClick={async () => {
                  await setActiveProfile(p.id);
                  onDone();
                }}
                className={`w-full flex items-center justify-between px-5 py-5 rounded-2xl border-2 bg-white text-slate-800 text-left transition-all active:scale-[0.98] ${
                  isActive ? 'shadow-md' : 'border-slate-200 hover:border-slate-300'
                }`}
                style={isActive ? { borderColor: p.colorHex } : undefined}
              >
                <span className="flex items-center space-x-3 min-w-0">
                  <ProfileDot colorHex={p.colorHex} className="w-4 h-4" />
                  <span className="text-xl font-bold truncate">{p.name}</span>
                </span>
                {isActive && <Check className="w-6 h-6 shrink-0" style={{ color: p.colorHex }} />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setAdding(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 font-bold flex items-center justify-center space-x-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add another profile</span>
        </button>
      </div>
    </div>
  );
}
