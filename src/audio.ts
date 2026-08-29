import * as Tone from 'tone';

export class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  private isReady = false;

  constructor() {
    // Setup listeners on window to automatically unlock on first user gesture
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.init();
      };
      ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach(evt => {
        window.addEventListener(evt, unlock, { passive: true });
      });
    }
  }

  async init() {
    try {
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }

      if (!this.sampler) {
        // We use Tone.js Sampler with the Salamander Grand Piano samples.
        // We strictly use the 7-sample subset covering the core Eguchi chords.
        this.sampler = new Tone.Sampler({
          urls: {
            A3: "A3.mp3",
            C4: "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            A4: "A4.mp3",
            C5: "C5.mp3",
            "D#5": "Ds5.mp3"
          },
          baseUrl: "/audio/piano/",
          attack: 0,
          release: 0.15,
        }).toDestination();
      }

      await Tone.loaded();
      this.isReady = true;
    } catch (err) {
      console.warn('Could not initialize Tone.js AudioContext:', err);
      throw new Error("Failed to load required audio files. Please check your connection or reload.");
    }
  }

  get ready() {
    return this.isReady && Tone.context.state === 'running';
  }

  /**
   * Play an acoustic piano chord using Tone.js Sampler
   * @param onStart Optional callback fired exactly when audio playback begins (via Tone.Draw)
   */
  playChord(midiNotes: number[], onStart?: () => void): number {
    if (!this.sampler || Tone.context.state !== 'running') return 2000;

    const duration = 2.2;
    // Schedule exactly now as requested
    const startTime = Tone.now();

    // Convert MIDI note numbers to standard note strings (e.g., "C4")
    const notes = midiNotes.map(note => Tone.Frequency(note, "midi").toNote());

    this.sampler.triggerAttackRelease(
      notes,
      1.5,
      startTime,
      0.65
    );
    
    // Synchronize UI precisely with audio onset if callback provided
    if (onStart) {
      Tone.Draw.schedule(() => {
        onStart();
      }, startTime);
    }

    return duration * 1000;
  }

  playErrorTone(): number {
    if (Tone.context.state !== 'running') return 400;
    
    const startTime = Tone.now() + 0.05;
    const osc = new Tone.Oscillator(160, "sine").toDestination();
    
    osc.start(startTime);
    osc.stop(startTime + 0.4);
    
    // Quick amplitude envelope
    osc.volume.setValueAtTime(-100, startTime);
    osc.volume.linearRampToValueAtTime(-14, startTime + 0.03);
    osc.volume.exponentialRampToValueAtTime(-100, startTime + 0.35);

    return 400;
  }

  playSuccessTone(): number {
    if (Tone.context.state !== 'running') return 450;
    
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
