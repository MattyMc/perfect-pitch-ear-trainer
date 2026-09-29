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
- **`init()`:** if the context is not running, calls `Tone.start()` and waits up to `RESUME_TIMEOUT_MS` (1.5 s) for it; then constructs the sampler if there isn't one and `await Tone.loaded()`. The seven samples are fetched and decoded once, into a `Tone.ToneAudioBuffers` the engine keeps; decoded audio isn't tied to a context, so the sampler rebuilt for a new context is built from those buffers with no download or decode. `Tone.start()` runs before `init()`'s first `await`, so a call made inside a gesture resumes the context within it. This is the loading gate, so a chord is never triggered before all seven buffers have decoded. It rejects with `AudioNeedsGestureError` when sound needs a tap first (the context is stale, or would not resume in time, which also marks it stale so the next tap builds a fresh one rather than retry a context stuck `interrupted`). A failed load discards the sampler and the samples, so the next `init()` downloads them again; otherwise it rejects on failure with `"Failed to load required audio files. Please check your connection or reload."`.
- **`play(midiNotes, durationMs)`:** how components play a chord: awaits `init()`, then `playChord`. Resolves `'played'`, or `'needs-tap'` (having played nothing) instead of throwing `AudioNeedsGestureError`, and also when the chord still couldn't sound (a rebuild replaced the sampler while it waited), so a trial is never scored against silence. Rejects only on a load failure.
- **Gesture unlock:** the constructor attaches `click`, `touchstart`, `touchend`, `pointerdown`, and `keydown` listeners to `window`. They are passive, not `once`, and stay attached for the life of the page. Each runs synchronously inside the gesture: it rebuilds a stale context (below), then calls `init()`, which resumes a suspended one. So any tap starts the piano loading; screens don't need to call `init()` themselves.
- **Recovery from the background:** iOS can hand a PWA back from the background with a context that reports `running` but plays nothing ([WebKit 263627](https://bugs.webkit.org/show_bug.cgi?id=263627)), or one stuck `interrupted` that `resume()` cannot revive ([WebKit 273511](https://bugs.webkit.org/show_bug.cgi?id=273511)). Neither is reliably detectable, so the engine marks the context **stale** on `visibilitychange` to visible, on a persisted `pageshow`, and when the context leaves `running` on its own (`statechange`), provided it had been in use. The next gesture stops any chord, disposes the sampler, swaps in a fresh `Tone.Context` with `Tone.setContext(new Tone.Context(), true)` (which closes the old one), and calls `init()` to resume it, all inside the gesture because iOS only starts audio from one. `init()` builds the new sampler from the already-decoded samples. The engine reads the context through `Tone.getContext()`, never `Tone.context`, which is a constant bound to the first context at import.
- **`playChord(midiNotes, durationMs)`:** first calls `stopChord()`, so a new chord always replaces the old one. If the sampler is missing or still loading (just after a rebuild), or the context is not running, it plays nothing rather than let Tone throw, and returns `false`. Otherwise `triggerAttack(notes, Tone.now(), 0.65)`, and a `setTimeout` calls `triggerRelease(notes)` after `durationMs`, and it returns `true`; callers take their timing from the profile's config. MIDI numbers are converted with `Tone.Frequency(n, "midi").toNote()`; the note strings never reach the UI.
- **`stopChord()`:** if a release is still pending, cancels it and calls `releaseAll()`, cutting the chord off with the 0.15 s release fade. A no-op when nothing is sounding. The release is a timer rather than `triggerAttackRelease` on purpose: that method schedules the release by calling `triggerRelease` immediately, which empties the sampler's active-source list, so a later `releaseAll()` finds nothing and the chord cannot be interrupted.
- **`playSuccessTone()`:** two fresh sine `Tone.Oscillator`s, E6 (1318.5 Hz) then G6 (1568 Hz) 90 ms later, each about 0.35 s with a 15 ms ramp up to −16 dB and an exponential decay. Scheduled from `Tone.now() + 0.05`. Returns 450. The oscillators are never disposed.
- **`speak(text)`:** Web Speech API. Cancels pending speech, resumes if paused, creates an utterance with `rate 0.92`, `pitch 1.0`, `volume 1.0`, no `lang`. Prefers the first English voice whose name contains Natural, Google, Samantha, or Karen. Resolves on `onend` or `onerror`, or after `max(1000, words × 400 + 400)` ms as a fallback because browsers routinely drop `onend`. If speech synthesis is unavailable it resolves after 800 ms.

## Failure handling by caller

When `play()` resolves `'needs-tap'`, `Practice` and `IntroMode` show `ResumePrompt` ("Ready to continue?", with hold-to-exit), whose Continue tap rebuilds the audio and reruns the step (for the intro's first step, from the spoken instruction). A replay just returns to its previous state (the replay button is itself a tap) and is not counted. The correction replay after a wrong answer goes through `play()` too, because the wrong tap may itself have rebuilt the audio; if it needs another tap it skips straight to the correction tap rather than show Continue, which would restart the trial. The dashboard's test chord just re-enables its button. For load failures, `Practice` catches `play()` and renders a full-screen "Audio Error" panel with a "Return to Menu" button. `IntroMode`, `ParentDashboard`, and `ParentGuide` do not catch; a load failure there is an unhandled rejection, and `IntroMode` would sit on its listening indicator indefinitely. Listed in [known-issues.md](known-issues.md).

## Timing coupling

Chord length and the card lock are per-profile settings (`chordDurationMs`, `inputLockMs` on the config row), resolved by `resolvePlaybackTiming` in `src/utils/playbackTiming.ts`. The default is a 1.5 s hold (audible for about 1.65 s with the release) with the cards locked for the first 0.5 s ("Whole chord", stored as `inputLockMs: null`, locks them until the chord ends). `Practice` passes the chord length to `playChord` and waits only for the lock before enabling the cards; the chord keeps sounding until it ends or a tap calls `stopChord()`. `IntroMode` plays the chord length and waits for all of it, then speaks the colour. The dashboard's test button and the guide's chord previews play at the profile's chord length, and the test button speaks "Red" when the chord ends.

## What the spec wanted that is not here

- `Tone.Draw` for UI synchronisation. The UI uses `setTimeout`.
- Cache Storage / a service worker so samples are available offline. There is none; the first gesture on each launch fetches about 483 KB.
- Version stamping of the audio pack on session records.
- An enforced repitch limit.
