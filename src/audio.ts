import * as Tone from 'tone';

/** How long `init()` waits for a suspended context to resume before asking for a tap. */
export const RESUME_TIMEOUT_MS = 1500;

/**
 * Thrown by `init()` when sound cannot start without a user gesture: the context is stale (see
 * below) or will not resume. Callers show a "Continue" button; its tap rebuilds the audio.
 */
export class AudioNeedsGestureError extends Error {
  constructor() {
    super('Sound needs a tap to start again.');
    this.name = 'AudioNeedsGestureError';
  }
}

const GESTURE_EVENTS = ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'] as const;

/**
 * The 7-sample Salamander Grand Piano subset covering the Eguchi chords; Tone interpolates every
 * other pitch. BASE_URL is `base` from vite.config.ts, with a trailing slash, and that base is the
 * same subpath in dev, preview and production, so a hardcoded "/audio/piano/" 404s on Pages.
 */
const PIANO_SAMPLES = {
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
};
const PIANO_BASE_URL = `${import.meta.env.BASE_URL}audio/piano/`;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/**
 * iOS Safari puts Web Audio in the 'ambient' audio session by default, which the silent switch
 * mutes, so on a phone set to silent every chord would play as silence. 'playback', the category
 * music apps use, plays through the switch. It also pauses other apps' audio, such as music, from
 * the first tap (Tone keeps its context running from then on). A page cannot read the switch, so
 * claiming the session is the only fix.
 *
 * The type belongs to the page, not to a context, and must be set before the first context is
 * created. `index.html` does that, since Tone creates its context as soon as it loads, before any
 * of this code runs. `rebuildContext` calls this again only defensively. `navigator.audioSession` is Safari-only (16.4+) and still a draft, so it is not in
 * the DOM types and may be absent; elsewhere this does nothing.
 */
export function claimPlaybackAudioSession() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = 'playback';
}

/** What `play()` managed: the chord started, or sound needs a tap first (nothing played). */
export type PlayResult = 'played' | 'needs-tap';

export class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  /**
   * The piano samples, downloaded and decoded once. Decoded audio isn't tied to a context, so a
   * sampler rebuilt on a new context reuses these instead of fetching and decoding them again.
   */
  private samples: Tone.ToneAudioBuffers | null = null;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Set when the audio context can no longer be trusted: the app came back from the background,
   * or the context left 'running' on its own. On iOS a PWA brought back to the foreground can
   * keep a context that reports 'running' but plays nothing (WebKit bug 263627), or one stuck
   * 'interrupted' that resume() cannot revive (WebKit bug 273511). Neither is reliably
   * detectable, so a stale context is replaced with a new one on the next tap.
   */
  private stale = false;
  private watchedContext: Tone.BaseContext | null = null;
  private contextWasRunning = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Stay attached, not once: every gesture is a chance to unlock or rebuild the audio.
      GESTURE_EVENTS.forEach(evt => window.addEventListener(evt, this.handleGesture, { passive: true }));
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('pageshow', this.handlePageShow);
    }
  }

  /** Removes the engine's listeners. The app's singleton never needs this; tests do. */
  dispose() {
    if (typeof window !== 'undefined') {
      GESTURE_EVENTS.forEach(evt => window.removeEventListener(evt, this.handleGesture));
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('pageshow', this.handlePageShow);
    }
    this.unwatchContext();
  }

  /**
   * Runs synchronously inside every user gesture, because iOS only lets an audio context be
   * created and resumed from one. Anything done after an await would be too late.
   */
  private handleGesture = () => {
    if (this.stale) this.rebuildContext();
    // init() resumes the context before its first await, so that still happens in the gesture.
    // Load errors surface where playback awaits init(); nothing to report from here.
    this.init().catch(() => {});
  };

  private handleVisibilityChange = () => {
    // Only a context that has been used can have gone bad.
    if (document.visibilityState === 'visible' && this.sampler) this.stale = true;
  };

  private handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted && this.sampler) this.stale = true;
  };

  private handleStateChange = (state: AudioContextState | 'interrupted') => {
    if (state === 'running') {
      this.contextWasRunning = true;
    } else if (this.contextWasRunning) {
      // Left 'running' without us asking: an interruption, or the OS suspending it.
      this.stale = true;
    }
  };

  private watchContext() {
    const context = Tone.getContext();
    if (this.watchedContext === context) return;
    this.unwatchContext();
    this.watchedContext = context;
    this.contextWasRunning = context.state === 'running';
    context.on('statechange', this.handleStateChange);
  }

  private unwatchContext() {
    this.watchedContext?.off('statechange', this.handleStateChange);
    this.watchedContext = null;
  }

  /** Swaps in a new audio context. Must run inside a gesture, with init() after it (see above). */
  private rebuildContext() {
    this.stopChord();
    this.sampler?.dispose();
    this.sampler = null;
    this.unwatchContext();
    // Defensive: index.html already claimed it for the page, but it costs nothing to be sure.
    claimPlaybackAudioSession();
    Tone.setContext(new Tone.Context(), true);
    this.stale = false;
    this.watchContext();
  }

  /**
   * Makes sure the context is running and the piano is loaded. Rejects with
   * `AudioNeedsGestureError` when that needs a tap first, rather than hanging or letting a
   * chord play into a dead context.
   */
  async init() {
    this.watchContext();
    if (this.stale) throw new AudioNeedsGestureError();

    // Tone.start() must stay ahead of any await: iOS only lets it resume inside the gesture.
    if (Tone.getContext().state !== 'running') {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resumed = await Promise.race([
        Tone.start().then(() => true, () => false),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), RESUME_TIMEOUT_MS); }),
      ]);
      clearTimeout(timer);
      if (!resumed || Tone.getContext().state !== 'running') {
        // Retrying resume() on a context stuck 'interrupted' never works, so the next tap
        // builds a fresh one instead.
        this.stale = true;
        throw new AudioNeedsGestureError();
      }
    }

    try {
      if (!this.sampler) {
        const samples = this.samples ??= new Tone.ToneAudioBuffers({ urls: PIANO_SAMPLES, baseUrl: PIANO_BASE_URL });
        const urls = Object.fromEntries(Object.keys(PIANO_SAMPLES).map(note => [note, samples.get(note)]));
        this.sampler = new Tone.Sampler({ urls, attack: 0, release: 0.15 }).toDestination();
      }

      await Tone.loaded();
    } catch (err) {
      // Drop what failed, so the next init() downloads the samples again rather than reusing
      // a set that will never finish loading.
      this.sampler?.dispose();
      this.sampler = null;
      this.samples = null;
      console.warn('Could not initialize Tone.js AudioContext:', err);
      throw new Error("Failed to load required audio files. Please check your connection or reload.");
    }
  }

  /**
   * Readies the audio, then plays the chord (see `playChord`). Resolves 'needs-tap', having
   * played nothing, when sound needs a tap first; rejects only if the piano failed to load.
   */
  async play(midiNotes: number[], durationMs: number): Promise<PlayResult> {
    try {
      await this.init();
    } catch (err) {
      if (err instanceof AudioNeedsGestureError) return 'needs-tap';
      throw err;
    }
    // If it still couldn't sound (a rebuild replaced the sampler while this waited), a tap will
    // bring it back; reporting 'played' would let a trial be scored against silence.
    return this.playChord(midiNotes, durationMs) ? 'played' : 'needs-tap';
  }

  /**
   * Play an acoustic piano chord using Tone.js Sampler, held for `durationMs` and then
   * released. Any chord still sounding is cut off first. `stopChord` ends it early. Returns
   * whether it played. Components call `play()`, which readies the audio first.
   *
   * The release is a timer rather than `triggerAttackRelease`, because that schedules the
   * release by calling `triggerRelease` immediately, which empties the sampler's list of
   * active sources — after that, `releaseAll()` finds nothing and the chord cannot be
   * interrupted.
   */
  playChord(midiNotes: number[], durationMs: number): boolean {
    this.stopChord();
    // A sampler still loading would make Tone throw; play nothing, and say so.
    if (!this.sampler?.loaded || Tone.getContext().state !== 'running') return false;

    // Convert MIDI note numbers to standard note strings (e.g., "C4")
    const notes = midiNotes.map(note => Tone.Frequency(note, "midi").toNote());
    const sampler = this.sampler;

    // Schedule exactly now as requested
    sampler.triggerAttack(notes, Tone.now(), 0.65);
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      sampler.triggerRelease(notes);
    }, durationMs);
    return true;
  }

  /** Cuts off a sounding chord now (with the sampler's short release fade). Safe when silent. */
  stopChord() {
    // No pending release means the chord was already released (triggerRelease empties the
    // sampler's active list), so there is nothing left to cut off.
    if (this.releaseTimer === null) return;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    this.sampler?.releaseAll();
  }

  playSuccessTone(): number {
    if (Tone.getContext().state !== 'running') return 450;
    
    const startTime = Tone.now() + 0.05;
    
    // Pleasant two-tone chime (E6 -> G6)
    [
      { freq: 1318.5, delay: 0 },
      { freq: 1567.98, delay: 0.09 }
    ].forEach(chime => {
      const osc = new Tone.Oscillator(chime.freq, "sine").toDestination();
      const st = startTime + chime.delay;
      
      osc.start(st);
      osc.stop(st + 0.35);
      
      osc.volume.setValueAtTime(-100, st);
      osc.volume.linearRampToValueAtTime(-16, st + 0.015);
      osc.volume.exponentialRampToValueAtTime(-100, st + 0.3);
    });

    return 450;
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setTimeout(resolve, 800);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        let resolved = false;
        const finish = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        utterance.onend = finish;
        utterance.onerror = finish;
        // Fallback safety timer if browser speechSynthesis fails to fire onend
        const words = text.split(' ').length;
        const estimatedDurationMs = Math.max(1000, words * 400 + 400);
        setTimeout(finish, estimatedDurationMs);

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')));
          if (preferred) utterance.voice = preferred;
        }
        
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis error:', e);
        setTimeout(resolve, 800);
      }
    });
  }
}

export const audio = new AudioEngine();
