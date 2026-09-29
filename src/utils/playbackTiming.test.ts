import { describe, expect, it } from 'vitest';
import {
  CHORD_DURATION_OPTIONS_MS,
  DEFAULT_CHORD_DURATION_MS,
  DEFAULT_INPUT_LOCK_MS,
  INPUT_LOCK_OPTIONS_MS,
  resolvePlaybackTiming,
} from './playbackTiming';

describe('resolvePlaybackTiming', () => {
  it('defaults a config with no timing fields to a 1.5 s chord and a 0.5 s lock', () => {
    expect(DEFAULT_CHORD_DURATION_MS).toBe(1500);
    expect(DEFAULT_INPUT_LOCK_MS).toBe(500);
    expect(resolvePlaybackTiming({})).toEqual({ chordDurationMs: 1500, inputLockMs: 500 });
  });

  it('keeps a lock shorter than the chord, so the child can answer while it still sounds', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 3000, inputLockMs: 500 })).toEqual({
      chordDurationMs: 3000,
      inputLockMs: 500,
    });
  });

  it('uses the default lock when none is set, whatever the chord length', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 4000 }).inputLockMs).toBe(500);
  });

  it('locks for the whole chord when the lock is null', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 4000, inputLockMs: null }).inputLockMs).toBe(4000);
  });

  it('never locks the buttons for longer than the chord plays', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 1500, inputLockMs: 2000 }).inputLockMs).toBe(1500);
  });

  it('falls back to the default for a missing or nonsensical chord duration', () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolvePlaybackTiming({ chordDurationMs: bad }).chordDurationMs).toBe(DEFAULT_CHORD_DURATION_MS);
    }
  });

  it('treats a negative or non-finite lock as no lock beyond zero', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 2000, inputLockMs: -5 }).inputLockMs).toBe(0);
    expect(resolvePlaybackTiming({ chordDurationMs: 2000, inputLockMs: Number.NaN }).inputLockMs).toBe(500);
  });
});

describe('option lists', () => {
  it('offers the defaults as choices', () => {
    expect(CHORD_DURATION_OPTIONS_MS).toContain(DEFAULT_CHORD_DURATION_MS);
    expect(INPUT_LOCK_OPTIONS_MS).toContain(DEFAULT_INPUT_LOCK_MS);
  });

  it('offers only locks that are shorter than the longest chord', () => {
    const longest = Math.max(...CHORD_DURATION_OPTIONS_MS);
    for (const lock of INPUT_LOCK_OPTIONS_MS) expect(lock).toBeLessThan(longest);
  });
});
