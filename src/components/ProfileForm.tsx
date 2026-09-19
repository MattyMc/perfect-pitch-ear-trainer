import { useState, FormEvent } from 'react';
import { ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { PROFILE_NAME_MAX_LENGTH, PROFILE_COLOURS, ProfileColour, normaliseProfileName } from '../db';
import { describeError } from './DatabaseErrorScreen';

type Tone = 'dark' | 'light';

/** Class strings per tone, indexed once per render. */
const TONE = {
  dark: {
    label: 'text-slate-300',
    input: 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500',
    cancel: 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300',
    swatchRing: 'ring-white ring-offset-slate-900',
    error: 'text-rose-300',
    noticeIcon: 'text-emerald-400',
    noticeLead: 'text-slate-100',
    noticeBody: 'text-slate-400',
  },
  light: {
    label: 'text-slate-600',
    input: 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500',
    cancel: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700',
    swatchRing: 'ring-slate-900 ring-offset-white',
    error: 'text-rose-700',
    noticeIcon: 'text-emerald-600',
    noticeLead: 'text-slate-900',
    noticeBody: 'text-slate-600',
  },
} as const;

interface ProfileFormProps {
  tone: Tone;
  submitLabel: string;
  /** The profile's own colour when editing, or a suggested unused one when creating. */
  initialColor: ProfileColour;
  onSubmit: (name: string, colorHex: ProfileColour) => Promise<void> | void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Pre-filled name when editing an existing profile. */
  initialName?: string;
  /** The privacy statement belongs on every *creation* screen; a rename can omit it. */
  showPrivacyNotice?: boolean;
}

/**
 * The privacy statement shown wherever a profile is created. Everything it claims is
 * checked in docs/data-and-privacy.md — keep the two in step. Deliberately quiet:
 * reassurance beside the name field, not a card competing with it.
 */
function PrivacyNotice({ t }: { t: (typeof TONE)[Tone] }) {
  return (
    <div className="flex items-start space-x-3">
      <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${t.noticeIcon}`} aria-hidden="true" />
      <div className="space-y-1 text-sm leading-relaxed">
        <p className={`font-semibold ${t.noticeLead}`}>Nothing leaves this device.</p>
        <p className={t.noticeBody}>
          No account, no sign-in, no sync. This name and all practice history stay in this browser.
          Clearing its site data erases them, so back up from the Parent area if you want a copy.
        </p>
      </div>
    </div>
  );
}

export default function ProfileForm({
  tone,
  submitLabel,
  initialColor,
  onSubmit,
  onCancel,
  cancelLabel = 'Cancel',
  initialName = '',
  showPrivacyNotice = true,
}: ProfileFormProps) {
  const t = TONE[tone];
  const [name, setName] = useState(initialName);
  const [colorHex, setColorHex] = useState<ProfileColour>(initialColor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleaned = normaliseProfileName(name);
  const canSubmit = cleaned.length > 0 && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(cleaned, colorHex);
    } catch (err) {
      // A failed IndexedDB write (quota, a database that would not open) must not look
      // like success. Surface it; the parent's data is untouched either way.
      setError(`Could not save. ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="profile-name" className={`block text-sm font-semibold ${t.label}`}>
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Oliver"
          maxLength={PROFILE_NAME_MAX_LENGTH}
          autoFocus
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          className={`w-full px-4 py-3.5 rounded-2xl border-2 text-lg font-semibold outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 transition-colors ${t.input}`}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={`block text-sm font-semibold ${t.label}`}>Colour</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Profile colour">
          {PROFILE_COLOURS.map((c) => {
            const selected = c.hex === colorHex;
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.name}
                onClick={() => setColorHex(c.hex)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 ${
                  selected ? `scale-110 ring-[3px] ring-offset-2 ${t.swatchRing}` : 'active:scale-95'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {selected && <Check className="w-5 h-5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {showPrivacyNotice && <PrivacyNotice t={t} />}

      {error && (
        <p role="alert" className={`text-sm font-semibold ${t.error}`}>
          {error}
        </p>
      )}

      <div className="flex space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`py-4 px-6 rounded-2xl font-bold transition-colors ${t.cancel}`}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl font-bold text-lg text-white flex items-center justify-center space-x-2 shadow-lg transition-colors"
        >
          <span>{submitLabel}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
