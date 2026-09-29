import type { AppConfig } from '../db';

/**
 * How long each chord sounds, in ms. The chord is held this long, then fades over the
 * sampler's 0.15 s release. 1.5 s is the hold the app always used before this was a setting.
 */
export const CHORD_DURATION_OPTIONS_MS = [1500, 2000, 3000, 4000] as const;
export const DEFAULT_CHORD_DURATION_MS = 1500;

/**
 * How long the answer cards stay disabled after a chord starts, in ms, as offered in the
 * dashboard. The default is 0.5 s; a stored `null` means "Whole chord" (locked until the chord
 * ends). A lock shorter than the chord lets the child answer while it still sounds; the tap
 * cuts the chord off. Every option is shorter than the longest chord, and the resolved lock is
 * clamped to the chord, so a lock can never outlast the sound it guards.
 */
export const INPUT_LOCK_OPTIONS_MS = [500, 1000, 2000] as const;
export const DEFAULT_INPUT_LOCK_MS = 500;

export interface PlaybackTiming {
  chordDurationMs: number;
  inputLockMs: number;
}

/** The timing a practice screen should use, from a config whose fields may be absent. */
export function resolvePlaybackTiming(config: Pick<AppConfig, 'chordDurationMs' | 'inputLockMs'>): PlaybackTiming {
  const { chordDurationMs, inputLockMs } = config;
  const duration =
    chordDurationMs !== undefined && Number.isFinite(chordDurationMs) && chordDurationMs > 0
      ? chordDurationMs
      : DEFAULT_CHORD_DURATION_MS;
  const requestedLock =
    inputLockMs === null ? duration
      : inputLockMs !== undefined && Number.isFinite(inputLockMs) ? inputLockMs
      : DEFAULT_INPUT_LOCK_MS;
  const lock = Math.min(Math.max(requestedLock, 0), duration);
  return { chordDurationMs: duration, inputLockMs: lock };
}

/** "1.5 s", "2 s" — for the dashboard's option buttons. */
export function formatSeconds(ms: number): string {
  return `${ms / 1000} s`;
}
