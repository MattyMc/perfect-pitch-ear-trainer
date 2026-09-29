import type { AppConfig } from '../db';
import {
  CHORD_DURATION_OPTIONS_MS, INPUT_LOCK_OPTIONS_MS, formatSeconds, resolvePlaybackTiming,
} from '../utils/playbackTiming';

type TimingFields = Pick<AppConfig, 'chordDurationMs' | 'inputLockMs'>;

interface PlaybackTimingSettingsProps {
  config: TimingFields;
  /** A patch for the profile's config row. `inputLockMs: undefined` means "whole chord". */
  onChange: (patch: TimingFields) => void;
}

const optionClass = (selected: boolean) =>
  `py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
    selected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
  }`;

/** The dashboard's chord-length and card-lock controls. */
export default function PlaybackTimingSettings({ config, onChange }: PlaybackTimingSettingsProps) {
  const { chordDurationMs, inputLockMs } = resolvePlaybackTiming(config);
  const locksWholeChord = inputLockMs === chordDurationMs;

  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
      <div className="space-y-1.5">
        <div>
          <span id="chord-length-label" className="text-xs font-bold text-slate-800 block">Chord length</span>
          <span className="text-[11px] text-slate-500">How long each chord plays</span>
        </div>
        <div role="group" aria-labelledby="chord-length-label" className="grid grid-cols-4 gap-1.5">
          {CHORD_DURATION_OPTIONS_MS.map((ms) => (
            <button
              key={ms}
              aria-pressed={chordDurationMs === ms}
              // A saved lock that no longer fits is shown as "Whole chord", so clear it to match;
              // otherwise it would silently return if the chord were lengthened again.
              onClick={() => onChange(
                config.inputLockMs !== undefined && config.inputLockMs >= ms
                  ? { chordDurationMs: ms, inputLockMs: undefined }
                  : { chordDurationMs: ms },
              )}
              className={optionClass(chordDurationMs === ms)}
            >
              {formatSeconds(ms)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div>
          <span id="card-lock-label" className="text-xs font-bold text-slate-800 block">Lock the cards for</span>
          <span className="text-[11px] text-slate-500">From the moment each chord starts</span>
        </div>
        <div role="group" aria-labelledby="card-lock-label" className="grid grid-cols-4 gap-1.5">
          {INPUT_LOCK_OPTIONS_MS.map((ms) => {
            const selected = !locksWholeChord && inputLockMs === ms;
            return (
              <button
                key={ms}
                aria-pressed={selected}
                // A lock as long as the chord is just "Whole chord", so it is not offered twice.
                disabled={ms >= chordDurationMs}
                onClick={() => onChange({ inputLockMs: ms })}
                className={optionClass(selected)}
              >
                {formatSeconds(ms)}
              </button>
            );
          })}
          <button
            aria-pressed={locksWholeChord}
            onClick={() => onChange({ inputLockMs: undefined })}
            className={optionClass(locksWholeChord)}
          >
            Whole chord
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        A short lock stops accidental taps from counting as answers. Once it lifts, your child can answer while the chord is still playing, and tapping a card stops the chord. Without a tap, the chord plays to the end.
      </p>
    </div>
  );
}
