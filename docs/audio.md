# Audio

Source: `src/audio.ts`, a module-level singleton `audio = new AudioEngine()`. No component imports `tone` directly.

## Piano samples

Seven Salamander Grand Piano MP3s in `public/audio/piano/`, loaded into one `Tone.Sampler`:

| Note | MIDI | File |
|---|---|---|
| A3 | 57 | `A3.mp3` |
| C4 | 60 | `C4.mp3` |
| D♯4 | 63 | `Ds4.mp3` |
| F♯4 | 66 | `Fs4.mp3` |
| A4 | 69 | `A4.mp3` |
| C5 | 72 | `C5.mp3` |
| D♯5 | 75 | `Ds5.mp3` |

URLs are built as `${import.meta.env.BASE_URL}audio/piano/`, so they work under the `/perfect-pitch-ear-trainer/` base in dev, preview, and production. Never hardcode a root-absolute path here (see `CLAUDE.md`).

**Provenance, verified 9 September 2026.** The seven files are byte-identical (SHA-256) to the files at `https://raw.githubusercontent.com/Tonejs/audio/master/salamander/`. They are 128 kbps 44.1 kHz joint-stereo MP3s encoded with LAME 3.99.5, 13 to 16 seconds long, untrimmed and unnormalised. Total size about 483 KB. Licence details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Repitching

Every pitch not in the table is produced by `Tone.Sampler` repitching the nearest sample. The curriculum uses 18 distinct pitches (MIDI 57 to 76). Six land exactly on a sample; the other twelve are each **exactly one semitone** from the nearest sample. No note is further than one semitone. MIDI 76 (E5, the top of Brown) sits one semitone above the highest sample rather than between two.

This one-semitone bound is a property of the chosen sample set, not something the code enforces. If a chord is ever added outside MIDI 56 to 76, add a sample or the bound is silently broken.

## The AudioEngine

- **Sampler settings:** `attack: 0`, `release: 0.15`, output straight to destination. No effects, no `Tone.Transport`, no `Tone.Draw`. A4 is Tone's default 440 Hz; tuning is not set explicitly.
- **`init()`:** calls `Tone.start()` if the context is not running, constructs the sampler once, then `await Tone.loaded()`. This is the loading gate: every playback path awaits `init()` first, so a chord is never triggered before all seven buffers have decoded. On failure it throws `"Failed to load required audio files. Please check your connection or reload."`.
- **Gesture unlock:** the constructor attaches `click`, `touchstart`, `touchend`, `pointerdown`, and `keydown` listeners to `window`, all calling `init()`. They are passive, not `once`, and stay attached for the life of the page. Re-entry is harmless because `init()` no-ops once the sampler exists.
- **`playChord(midiNotes)`:** if the sampler is missing or the context is not running it returns 2000 and plays nothing. Otherwise `triggerAttackRelease(notes, 1.5, Tone.now(), 0.65)` and returns 2200. MIDI numbers are converted with `Tone.Frequency(n, "midi").toNote()`; the note strings never reach the UI.
- **`playSuccessTone()`:** two fresh sine `Tone.Oscillator`s, E6 (1318.5 Hz) then G6 (1568 Hz) 90 ms later, each about 0.35 s with a 15 ms ramp up to −16 dB and an exponential decay. Scheduled from `Tone.now() + 0.05`. Returns 450. The oscillators are never disposed.
- **`speak(text)`:** Web Speech API. Cancels pending speech, resumes if paused, creates an utterance with `rate 0.92`, `pitch 1.0`, `volume 1.0`, no `lang`. Prefers the first English voice whose name contains Natural, Google, Samantha, or Karen. Resolves on `onend` or `onerror`, or after `max(1000, words × 400 + 400)` ms as a fallback because browsers routinely drop `onend`. If speech synthesis is unavailable it resolves after 800 ms.

## Failure handling by caller

`Practice` wraps `init()` in try/catch and renders a full-screen "Audio Error" panel with a "Return to Menu" button. `IntroMode`, `ChildHome`, `FirstRunOnboarding`, `ParentDashboard`, and `ParentGuide` do not catch; a load failure there is an unhandled rejection, and `IntroMode` would sit on its listening indicator indefinitely. Listed in [known-issues.md](known-issues.md).

## Timing coupling

The chord is audible for about 1.65 s (1.5 s hold + 0.15 s release). The UI waits 2200 ms after triggering, hardcoded in `Practice.tsx` and `IntroMode.tsx`, and ignores the value `playChord` returns. The parent dashboard's test button speaks "Red" 1200 ms after triggering, while the chord is still sounding. If the hold or release changes, update the component literals or the UI unlocks against the sound.

## What the spec wanted that is not here

- `Tone.Draw` for UI synchronisation. The UI uses `setTimeout`.
- Cache Storage / a service worker so samples are available offline. There is none; the first gesture on each launch fetches about 483 KB.
- Version stamping of the audio pack on session records.
- An enforced repitch limit.
