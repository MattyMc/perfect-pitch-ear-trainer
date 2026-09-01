# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on port 3001, bound to 0.0.0.0 (for testing on a phone/tablet on the LAN)
npm run build    # Production build to dist/
npm run preview  # Serve the built dist/
npm run lint     # tsc --noEmit — this is the only check in the project
```

**Node 20+ is required** (`.nvmrc` pins 20.11.1; `engines` declares `>=20`). This is not optional: `@tailwindcss/oxide` declares `node >= 20`, so on Node 18 npm silently skips its platform binary and every Vite command dies with `Cannot find native binding` — a message that misleadingly blames [an npm optional-dependency bug](https://github.com/npm/cli/issues/4828). If you hit that, check `node --version` before deleting lockfiles. `nvm use` picks up the `.nvmrc`.

Port 3001 is deliberate — 3000 is taken by a Rails app in this developer's setup.

There is no test framework, no ESLint, and no CI. `npm run lint` (a bare TypeScript type-check) is the full verification story; run it after any non-trivial change.

`strict` is on and the codebase passes it with zero errors — keep it that way rather than reaching for `any` or `!`. Note that `@types/react` was missing from this project for a while, which silently typed every hook and JSX element as `any`; if type errors ever vanish en masse, suspect the React types before believing the code got safer.

The app is a phone-first PWA and is portrait-locked — `RotateDeviceOverlay` blanks the screen in landscape, so browser testing needs a narrow viewport.

## What this app is

A trainer for the Eguchi absolute-pitch method: a child hears a fixed piano chord and taps the **colour** associated with it. Chords are never named as notes to the child — the colour *is* the identity. Training is parent-supervised, deliberately slow (weeks per chord), and all data stays local.

## Architecture

### View routing

There is no router. `src/App.tsx` holds a single `view` state of `'home' | 'practice' | 'parent'` and switches on it. Two gates sit in front of that:

- `config.hasCompletedOnboarding === false` short-circuits everything into `FirstRunOnboarding`.
- `view === 'parent'` renders `ParentDashboard` wrapped in `ParentGate` (a 1-second press-and-hold; no PIN). `ParentDashboard` has its own `subView` for the long-form `ParentGuide`.

The `'practice'` view forks on chord count, which is the single most important branch in the app:

- **1 active chord** → `IntroMode`: unscored familiarisation. Plays the chord, speaks its colour name, child taps one big card, three times. Writes a session row but no trials.
- **2+ active chords** → `Practice`: a real scored session with a card grid, correction loop, and per-trial persistence.

### Persistence (`src/db.ts`)

Dexie/IndexedDB (`EguchiDB`), three tables, read everywhere through `useLiveQuery` from `dexie-react-hooks`. There is no other state container — no Redux, no context, no prop-drilled data. Components query Dexie directly and re-render on write.

- `config` — a **single row with `id: 'config'`**. Seeded by a `db.on('ready')` hook if the table is empty. Holds `activeChordIds`, `trialsPerSession`, `hasCompletedOnboarding`, `currentLevelStartedAtUtc`.
- `sessions` — one row per practice attempt, with a `status` lifecycle: `active` → `completed` | `completed_short` | `interrupted` | `discarded`.
- `trials` — one row per presented sound. `firstAnswerCorrect` is *the* metric; everything upstream (dashboard accuracy, advancement eligibility) derives from it.

Schema changes require a new `this.version(n).stores({...})` block — v1's declared indexes (`startedAtUtc`, `completed`) did not match the interface and v2 corrects them to `startedAt, status`. Queries use `.where('startedAt')`.

### Curriculum model (`src/chords.ts`)

`CHORDS` is an **ordered** array of 14 chord definitions (9 white-key "Phase A", then 5 black-key "Phase B"), each with `midiNotes`, a `displayIdentity` colour name, and a `colorHex`. `CHORDS_MAP` indexes them by id.

**Invariant:** `config.activeChordIds` is always a *prefix* of `CHORDS` in array order. `ParentDashboard.addChord()` appends `CHORDS[activeChordIds.length]` and `removeLastChord()` slices the last one off. Reordering `CHORDS` therefore silently rewrites what every existing learner is practising — append new chords, don't reorder.

Advancement is never automatic. The dashboard shows a checklist (≥14 days at level, ≥95% over the last 100 trials, parent approval) but the "Introduce Next Chord" button is always enabled; the criteria are advisory. `currentLevelStartedAtUtc` resets on every add or remove.

### Audio (`src/audio.ts`)

A module-level singleton `audio` (`new AudioEngine()`). Its constructor attaches one-shot `click`/`touchstart`/`pointerdown`/`keydown` listeners to `window` so the AudioContext unlocks on the first user gesture anywhere; components still `await audio.init()` before playing, which is idempotent.

Playback is a `Tone.Sampler` over **7 Salamander Grand Piano samples** (`public/audio/piano/`, A3/C4/D♯4/F♯4/A4/C5/D♯5). Every other pitch is interpolated by Tone from those. Feedback sounds are synthesised `Tone.Oscillator` chirps, and correction prompts use the Web Speech API (`audio.speak`, which resolves on `onend` or a word-count-estimated fallback timer, since browsers routinely drop `onend`).

**Timing is hardcoded and duplicated.** `playChord` returns 2200ms and the components independently `await new Promise(r => setTimeout(r, 2200))` to know when playback ended. Changing the note duration in `audio.ts` means updating those literals in `Practice.tsx` and `IntroMode.tsx` too, or the UI unlocks early.

### The trial loop (`src/components/Practice.tsx`)

The core of the app. A `TrialState` union (`Initializing` → `Playing` → `Awaiting` → `Correct`/`Correcting` → `PlayingCorrection` → `CorrectionTap` → `Done`) drives both the UI and input locking. Input is accepted only in `Awaiting` and `CorrectionTap`.

Two refs guard the long `async` chains, and both matter: `isMountedRef` (bailing out after every `await` — React StrictMode double-mounts this component in dev) and `isProcessingRef` (a synchronous re-entry lock that `setState` cannot provide, since taps can land between awaits).

On a wrong answer the trial is **written twice**: first with `correctionIncomplete: true`, then re-`put` with the same `currentTrialId` once the child taps the correct card. The correction sequence is speak → pause → replay chord → require a tap on the target card, with the other cards dimmed and pointer-disabled.

Session sequences come from `generateSessionSequence` (`src/utils/scheduler.ts`): an evenly balanced bag of chord ids, Fisher-Yates shuffled, re-shuffled up to 100 times to avoid three identical chords in a row.

Sessions have a **10-minute idle timeout** (`SESSION_IDLE_TIMEOUT_MS`). On mount, `Practice` calls `checkAndCloseStaleSessions()` then `getResumeableSession()`; a live session resumes mid-sequence via a `NeedsResumeTap` screen that replays from `trials.length`.

## Known inconsistencies

These are live in the code — check before "fixing", and be aware they interact:

- `db.ts` `endSession()` and `checkAndCloseStaleSessions()` hardcode `scoredTrialCount === 25` for `'completed'`. With `trialsPerSession: 20` a fully finished session that exits via those paths is classified `'completed_short'`. The normal completion path in `Practice.saveTrial()` sets `'completed'` directly and is unaffected.
- `db.on('ready')` seeds `trialsPerSession: 25`; `ParentDashboard.resetData()` re-seeds it as `20`.
- `animate-fadeIn` (`FirstRunOnboarding`) and `animate-spin-slow` (`RotateDeviceOverlay`) are used but never defined — `src/index.css` is only `@import "tailwindcss"` with no `@theme` or `@keyframes` block.
- `public/manifest.json` references `/icon-192.png` and `/icon-512.png`, which do not exist.
- `FirstRunOnboarding` can finish with `'quickstart'` or `'guide'`, but `App.tsx` collapses both to the parent view; nothing deep-links into a guide section from onboarding.

## Provenance and stack notes

Generated in Google AI Studio, which leaves traces worth knowing about:

- `vite.config.ts` reads `DISABLE_HMR` to turn off HMR *and* file watching. It carries a comment asking not to modify it; it is inert outside AI Studio.
- `@/*` in `tsconfig.json` and `vite.config.ts` aliases the **repository root**, not `src/`. Nothing currently imports through it — all imports are relative.
- `@google/genai`, `express`, `dotenv`, `idb`, and `motion` are dependencies but are **not imported anywhere in `src/`**. `metadata.json` declares a Gemini API capability that the app does not use. Treat these as removable leftovers rather than as signals about the intended architecture.
- Tailwind v4 via `@tailwindcss/vite` — configuration is CSS-first, so there is no `tailwind.config.js`.
- Icons are `lucide-react`. Styling is Tailwind utility classes inline; there are no CSS modules or styled-components.
