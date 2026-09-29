import { describe, expect, it } from 'vitest';
import {
  CHORD_DURATION_OPTIONS_MS,
  DEFAULT_CHORD_DURATION_MS,
  INPUT_LOCK_OPTIONS_MS,
  resolvePlaybackTiming,
} from './playbackTiming';

describe('resolvePlaybackTiming', () => {
  it('defaults a config with no timing fields to the default chord, locked until it ends', () => {
    expect(resolvePlaybackTiming({})).toEqual({
      chordDurationMs: DEFAULT_CHORD_DURATION_MS,
      inputLockMs: DEFAULT_CHORD_DURATION_MS,
    });
  });

  it('keeps a lock shorter than the chord, so the child can answer while it still sounds', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 3000, inputLockMs: 500 })).toEqual({
      chordDurationMs: 3000,
      inputLockMs: 500,
    });
  });

  it('locks for the whole chord when no lock is set', () => {
    expect(resolvePlaybackTiming({ chordDurationMs: 4000 }).inputLockMs).toBe(4000);
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
    expect(resolvePlaybackTiming({ chordDurationMs: 2000, inputLockMs: Number.NaN }).inputLockMs).toBe(2000);
  });
});

describe('option lists', () => {
  it('offers the default chord duration as a choice', () => {
    expect(CHORD_DURATION_OPTIONS_MS).toContain(DEFAULT_CHORD_DURATION_MS);
  });

  it('offers only locks that are shorter than the longest chord', () => {
    const longest = Math.max(...CHORD_DURATION_OPTIONS_MS);
    for (const lock of INPUT_LOCK_OPTIONS_MS) expect(lock).toBeLessThan(longest);
  });
});
