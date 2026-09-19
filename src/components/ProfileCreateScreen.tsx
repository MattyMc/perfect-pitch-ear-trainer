import { CHORDS } from '../chords';
import { createProfile, ProfileColour } from '../db';
import ProfileForm from './ProfileForm';

interface ProfileCreateScreenProps {
  /** Starting swatch, normally the first palette colour no existing profile uses. */
  initialColor: ProfileColour;
  onCreated: () => void;
  /** Present when profiles already exist, so the parent can back out. */
  onCancel?: () => void;
}

/** The nine Phase A colours: what the learner is here for, and the one thing that is this app's own. */
const PREVIEW_COLOURS = CHORDS.slice(0, 9);

/**
 * Full-screen profile creation. Shown before anything else on a fresh install (it precedes
 * onboarding), and reused when another profile is added from the switcher or dashboard.
 */
export default function ProfileCreateScreen({ initialColor, onCreated, onCancel }: ProfileCreateScreenProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center p-6 max-w-md mx-auto w-full py-12 space-y-8">
        <div className="text-center space-y-4">
          {/* Purely decorative: the colours are named nowhere here, so nothing is leaked to a child. */}
          <div className="flex justify-center" aria-hidden="true">
            {PREVIEW_COLOURS.map((chord, i) => (
              <span
                key={chord.id}
                className={`w-7 h-7 rounded-full ring-[3px] ring-slate-700 ${i > 0 ? '-ml-2' : ''}`}
                style={{ backgroundColor: chord.colorHex, zIndex: PREVIEW_COLOURS.length - i }}
              />
            ))}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Who will be practicing?</h1>
            <p className="text-slate-400 text-sm">
              Progress is kept separately for each name. You can add more later.
            </p>
          </div>
        </div>

        <ProfileForm
          tone="dark"
          submitLabel="Continue"
          initialColor={initialColor}
          onSubmit={async (name, colorHex) => {
            await createProfile(name, colorHex);
            onCreated();
          }}
          onCancel={onCancel}
          cancelLabel="Back"
        />
      </div>
    </div>
  );
}
