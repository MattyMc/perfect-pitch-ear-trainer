import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tone = vi.hoisted(() => {
  /** Stands in for Tone.Context: a state, a resume we can make succeed or hang, and statechange. */
  class FakeContext {
    state = 'running';
    /** When false, resume() never settles — the iOS "stuck" case. */
    resumable = true;
    private handlers: Array<(state: string) => void> = [];
    resume = vi.fn(() => {
      if (!this.resumable) return new Promise<void>(() => {});
      this.state = 'running';
      return Promise.resolve();
    });
    dispose = vi.fn();
    on(event: string, handler: (state: string) => void) {
      if (event === 'statechange') this.handlers.push(handler);
      return this;
    }
    off(event: string, handler: (state: string) => void) {
      if (event === 'statechange') this.handlers = this.handlers.filter(h => h !== handler);
      return this;
    }
    /** Test helper: the browser changes the state on its own, as iOS does on an interruption. */
    changeState(state: string) {
      this.state = state;
      this.handlers.forEach(h => h(state));
    }
  }

  const makeSampler = () => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
    toDestination() { return this; },
  });

  const state = {
    current: new FakeContext(),
    samplers: [] as ReturnType<typeof makeSampler>[],
  };

  return {
    FakeContext,
    state,
    get sampler() { return state.samplers[state.samplers.length - 1]; },
    module: {
      Context: FakeContext,
      getContext: () => state.current,
      setContext: vi.fn((ctx: InstanceType<typeof FakeContext>, disposeOld = false) => {
        if (disposeOld) state.current.dispose();
        state.current = ctx;
      }),
      start: vi.fn(() => state.current.resume()),
      loaded: vi.fn(async () => {}),
      now: () => 10,
      Sampler: vi.fn(function () {
        const s = makeSampler();
        state.samplers.push(s);
        return s;
      }),
      Frequency: (n: number) => ({ toNote: () => `midi${n}` }),
    },
  };
});

vi.mock('tone', () => tone.module);

import { AudioEngine, AudioNeedsGestureError, RESUME_TIMEOUT_MS, audio } from './audio';

// The module's own singleton listens on window too; silence it so only each test's engine acts.
audio.dispose();

let engine: AudioEngine;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  tone.state.current = new tone.FakeContext();
  tone.state.samplers.length = 0;
  engine = new AudioEngine();
  await engine.init();
});

afterEach(() => {
  engine.dispose();
  vi.useRealTimers();
});

const tap = () => window.dispatchEvent(new Event('pointerdown'));
const returnToForeground = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('AudioEngine chord playback', () => {
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

// iOS can hand a PWA back from the background with an audio context that reports 'running' but
// plays nothing, or that is stuck 'interrupted'. Neither is reliably detectable, so the engine
// assumes the context is spent and builds a fresh one inside the next tap (iOS only lets audio
// start from a gesture).
describe('AudioEngine recovery after the app was in the background', () => {
  it('rebuilds the audio context, inside the first tap after returning to the foreground', async () => {
    const old = tone.state.current;
    returnToForeground();
    tap();

    // Synchronously, within the tap: new context in, old one disposed, new one resumed.
    expect(tone.module.setContext).toHaveBeenCalledTimes(1);
    expect(tone.state.current).not.toBe(old);
    expect(old.dispose).toHaveBeenCalled();
    expect(tone.state.current.resume).toHaveBeenCalled();

    // The piano is rebuilt on the new context and plays through it.
    await engine.init();
    expect(tone.module.Sampler).toHaveBeenCalledTimes(2);
    engine.playChord([60, 64, 67], 1500);
    expect(tone.sampler.triggerAttack).toHaveBeenCalled();
  });

  it('rebuilds after the context changes state on its own, as on an iOS interruption', () => {
    tone.state.current.changeState('interrupted');
    tap();
    expect(tone.module.setContext).toHaveBeenCalledTimes(1);
  });

  it('leaves a healthy context alone on ordinary taps', () => {
    tap();
    tap();
    expect(tone.module.setContext).not.toHaveBeenCalled();
    expect(tone.module.Sampler).toHaveBeenCalledTimes(1);
  });

  it('only rebuilds once per return, not on every later tap', () => {
    returnToForeground();
    tap();
    tap();
    expect(tone.module.setContext).toHaveBeenCalledTimes(1);
  });

  it('stops a sounding chord before swapping the context out', () => {
    engine.playChord([60, 64, 67], 3000);
    const oldSampler = tone.sampler;
    returnToForeground();
    tap();
    expect(oldSampler.releaseAll).toHaveBeenCalled();
    expect(oldSampler.dispose).toHaveBeenCalled();
  });

  it('asks for a tap when playback is due after a return but before any tap', async () => {
    returnToForeground();
    await expect(engine.init()).rejects.toBeInstanceOf(AudioNeedsGestureError);
    expect(tone.module.setContext).not.toHaveBeenCalled();
  });

  it('asks for a tap when the context will not resume, instead of hanging', async () => {
    tone.state.current.state = 'suspended';
    tone.state.current.resumable = false;
    const result = engine.init().then(() => 'resolved', (e: unknown) => e);

    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);
    expect(await result).toBeInstanceOf(AudioNeedsGestureError);
  });

  it('stops listening after dispose', () => {
    engine.dispose();
    returnToForeground();
    tap();
    expect(tone.module.setContext).not.toHaveBeenCalled();
  });
});
