import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tone = vi.hoisted(() => {
  /** Stands in for Tone.Context: a state, a resume we can make succeed or hang, and statechange. */
  class FakeContext {
    state = 'suspended';
    /** Safari's audio session type when this context was built; it must be claimed first. */
    audioSessionTypeAtCreation = (navigator as { audioSession?: { type: string } }).audioSession?.type;
    /** When false, resume() never settles — the iOS "stuck" case. */
    resumable = true;
    private handlers: Array<(state: string) => void> = [];
    resume = vi.fn(() => {
      if (!this.resumable) return new Promise<void>(() => {});
      this.changeState('running');
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
    loaded: true,
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
      /** Decoded samples: stands in for the downloaded, decoded mp3s. */
      ToneAudioBuffers: vi.fn(function (options: { urls: Record<string, string> }) {
        const decoded = Object.fromEntries(Object.keys(options.urls).map(note => [note, { decodedNote: note }]));
        return { get: (note: string) => decoded[note] };
      }),
      Sampler: vi.fn(function (_options: { urls: Record<string, unknown> }) {
        const s = makeSampler();
        state.samplers.push(s);
        return s;
      }),
      Frequency: (n: number) => ({ toNote: () => `midi${n}` }),
    },
  };
});

vi.mock('tone', () => tone.module);

import { AudioEngine, AudioNeedsGestureError, RESUME_TIMEOUT_MS, audio, claimPlaybackAudioSession } from './audio';

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

  it('plays nothing while the piano samples are still loading, rather than throwing', () => {
    // A rebuilt context gets a new sampler whose buffers take a moment to decode; triggering
    // it early makes Tone throw ("buffer is either not set or not loaded").
    tone.sampler.loaded = false;
    tone.sampler.triggerAttack.mockImplementation(() => { throw new Error('buffer is either not set or not loaded'); });

    expect(() => engine.playChord([60, 64, 67], 3000)).not.toThrow();
    expect(tone.sampler.triggerAttack).not.toHaveBeenCalled();
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

  it('decodes the piano once: a rebuilt sampler reuses the decoded samples instead of reloading', async () => {
    returnToForeground();
    tap();
    await engine.init();

    expect(tone.module.Sampler).toHaveBeenCalledTimes(2);
    expect(tone.module.ToneAudioBuffers).toHaveBeenCalledTimes(1);
    const [first, rebuilt] = tone.module.Sampler.mock.calls.map(call => call[0].urls);
    expect(Object.keys(rebuilt)).toHaveLength(7);
    for (const note of Object.keys(first)) expect(rebuilt[note]).toBe(first[note]);
  });

  it('claims the playback audio session before creating the new context', () => {
    // Stands in for Safari's navigator.audioSession; 'playback' plays through the silent switch.
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    try {
      returnToForeground();
      tap();
      expect(tone.state.current.audioSessionTypeAtCreation).toBe('playback');
    } finally {
      Reflect.deleteProperty(navigator, 'audioSession');
    }
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

  it('play() reports that a tap is needed instead of throwing, and plays nothing', async () => {
    returnToForeground();
    await expect(engine.play([60, 64, 67], 1500)).resolves.toBe('needs-tap');
    expect(tone.sampler.triggerAttack).not.toHaveBeenCalled();
  });

  it('play() readies the audio, then plays and reports it', async () => {
    returnToForeground();
    tap();
    await expect(engine.play([60, 64, 67], 1500)).resolves.toBe('played');
    expect(tone.sampler.triggerAttack).toHaveBeenCalledWith(['midi60', 'midi64', 'midi67'], 10, expect.any(Number));
  });

  it('play() reports a tap is needed when the chord could not actually sound', async () => {
    // e.g. a rebuild replaced the sampler while this play() was waiting for init().
    tone.sampler.loaded = false;
    await expect(engine.play([60, 64, 67], 1500)).resolves.toBe('needs-tap');
  });

  it('a resume that times out marks the context stale, so the next tap builds a fresh one', async () => {
    // iOS can leave a context stuck 'interrupted': retrying resume() on it never works.
    tone.state.current.state = 'suspended';
    tone.state.current.resumable = false;
    const result = engine.init().catch(() => {});
    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);
    await result;

    tap();
    expect(tone.module.setContext).toHaveBeenCalledTimes(1);
  });

  it('downloads the piano again after a failed load, instead of keeping the broken samples', async () => {
    const fresh = new AudioEngine();
    try {
      tone.module.loaded.mockRejectedValueOnce(new Error('network down'));
      await expect(fresh.init()).rejects.toThrow('Failed to load required audio files');

      await fresh.init();
      // One download for the shared test engine, then the failed one and the retry.
      expect(tone.module.ToneAudioBuffers).toHaveBeenCalledTimes(3);
    } finally {
      fresh.dispose();
    }
  });

  it('stops listening after dispose', () => {
    engine.dispose();
    returnToForeground();
    tap();
    expect(tone.module.setContext).not.toHaveBeenCalled();
  });
});

describe('claimPlaybackAudioSession', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'audioSession');
  });

  it("sets Safari's audio session to playback, so the silent switch does not mute the chords", () => {
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });

    claimPlaybackAudioSession();
    expect(session.type).toBe('playback');
  });

  it('does nothing in browsers without the Audio Session API', () => {
    expect('audioSession' in navigator).toBe(false);
    expect(() => claimPlaybackAudioSession()).not.toThrow();
  });
});
