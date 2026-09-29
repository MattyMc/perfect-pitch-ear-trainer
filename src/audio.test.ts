import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tone = vi.hoisted(() => {
  const sampler = {
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
    toDestination() { return this; },
  };
  return {
    sampler,
    module: {
      context: { state: 'running' },
      start: vi.fn(async () => {}),
      loaded: vi.fn(async () => {}),
      now: () => 10,
      Sampler: vi.fn(function () { return sampler; }),
      Frequency: (n: number) => ({ toNote: () => `midi${n}` }),
    },
  };
});

vi.mock('tone', () => tone.module);

import { AudioEngine } from './audio';

describe('AudioEngine chord playback', () => {
  let engine: AudioEngine;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    engine = new AudioEngine();
    await engine.init();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the chord for the requested duration, then releases it', () => {
    engine.playChord([60, 64, 67], 3000);

    expect(tone.sampler.triggerAttack).toHaveBeenCalledWith(['midi60', 'midi64', 'midi67'], 10, expect.any(Number));
    vi.advanceTimersByTime(2999);
    expect(tone.sampler.triggerRelease).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(tone.sampler.triggerRelease).toHaveBeenCalledWith(['midi60', 'midi64', 'midi67']);
  });

  it('stopChord cuts a sounding chord off immediately and cancels its scheduled release', () => {
    engine.playChord([60, 64, 67], 3000);
    vi.advanceTimersByTime(500);

    engine.stopChord();
    expect(tone.sampler.releaseAll).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    expect(tone.sampler.triggerRelease).not.toHaveBeenCalled();
  });

  it('a new chord replaces the old one, and the old release never cuts the new chord short', () => {
    engine.playChord([60, 64, 67], 3000);
    vi.advanceTimersByTime(1000);
    engine.playChord([60, 64, 67], 3000);
    expect(tone.sampler.releaseAll).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000); // the first chord's release would have fired here
    expect(tone.sampler.triggerRelease).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(tone.sampler.triggerRelease).toHaveBeenCalledTimes(1);
  });

  it('stopChord is safe when nothing is playing', () => {
    expect(() => engine.stopChord()).not.toThrow();
  });
});
