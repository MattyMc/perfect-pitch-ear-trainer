# Practice engine

How a session runs, how trials are scored and stored, how sequences are generated, and how sessions end. Sources: `src/components/Practice.tsx`, `src/components/IntroMode.tsx`, `src/utils/scheduler.ts`, `src/db.ts`, `src/App.tsx`.

## Two modes, chosen by chord count

`App.tsx` forks the `'practice'` view on `config.activeChordIds.length`:

- **1 chord → `IntroMode`.** Unscored familiarisation.
- **2 or more → `Practice`.** Scored session.

There is no other mode. In particular there is no note-naming mode for Phase B and no isolated-note assessment.

## IntroMode (one chord, unscored)

1. On mount, records the start time. Nothing is written yet.
2. Three steps. Each: play the chord for the profile's chord length and wait for all of it, enable the single card, show "Tap the Red card". The card lock setting does not apply here: the child always hears the chord and then the colour.
3. On tap: success chime, 800 ms, next step.
4. After the third tap, one `sessions` row is written already closed: `status: 'completed'`, `endReason: 'target_reached'`, `scoredTrialCount: 3`, `plannedTrialCount: 3`, `sequence: []`, with `startedAt` from step 1.

It writes **no `trials` rows** and never an `active` row, so an early hold-to-exit leaves nothing behind and the scored screen has nothing of its to resume. One consequence remains, listed in [known-issues.md](known-issues.md): the completed row counts toward "sessions today".

## Practice (two or more chords, scored)

### Session setup

On mount, in order:

1. `checkAndCloseStaleSessions()` closes **every** profile's `active` sessions idle for 10 minutes or more, so a sibling's abandoned session does not stay open for weeks.
2. `getResumeableSession(profileId)` returns this profile's newest `active` session idle for less than 10 minutes, if any. Another profile's live session is never resumed. IntroMode never writes an `active` row (its single row is written already `completed` when the three taps finish), so there is nothing of its to resume.
3. If one exists, the screen shows `NeedsResumeTap` and resumes at index `trials.length` of the stored `sequence`.
4. Otherwise a new session row is written with `status: 'active'`, `plannedTrialCount: trialsPerSession`, and a freshly generated `sequence`.

### Sequence generation (`generateSessionSequence`)

- Each active chord gets `floor(total / n)` presentations. The remainder is distributed one each to chords picked in a shuffled order, so counts differ by at most one and the beneficiaries are random.
- The bag is Fisher–Yates shuffled.
- A shuffle is rejected if any chord appears **three times in a row**. Two in a row is allowed. Up to 100 reshuffles; after that the last shuffle is returned unvalidated.
- The opener is unconstrained. Red is never forced first. There is no memory of previous sessions' openers.
- There is no adaptive weighting of any kind.

### Trial state machine

`TrialState` has eight members:

```
Initializing · NeedsResumeTap · Ready · Playing · Awaiting · Correct
CorrectionTap · Done
```

Input is accepted only in `Awaiting` and, for the right card alone, in `CorrectionTap`. A card is drawn only while it can be tapped; otherwise an empty dashed outline holds its place (see [child-ux.md](child-ux.md)). `Ready` is a 350 ms inter-trial pause with every card emptied.

**Normal trial**

```
Ready → Playing (chord starts; cards locked for inputLockMs) → Awaiting (chord may still be sounding)
  correct tap → Correct (chime, trial saved, 850 ms) → advance
  wrong tap   → CorrectionTap (soft note; trial saved; other cards emptied; the right
                card is live immediately, with no lock; chord replays 220 ms later)
  target tap  → no chime → advance
```

**A wrong answer is kept short.** A short, quiet marimba-like note (`playMissTone`, 6 dB under the chime) marks the miss; there is no voice, no pause, no pointer, no mark on the card that was tapped, and no lock on the right card. The chord starts again 220 ms later, on the note's quiet tail, and the child can tap the one remaining card whenever they like, which cuts the chord off and moves on without a success sound. A tap in those 220 ms skips the replay; a replay that starts late (the piano was still loading) after the child has already tapped is stopped. This replaces a spoken label, pause, locked replay, pointer, and chimed tap that the child experienced as a penalty. See D-018.

**A tap ends the chord.** Every accepted tap calls `audio.stopChord()` before the chime or the wrong-guess note, so with a lock shorter than the chord the child can answer mid-chord and the chord is cut off. Without a tap it plays its full length. Unmounting `Practice` also stops it.

**Replay.** A replay button is available in `Awaiting` and `CorrectionTap`. It restarts the chord (cutting off one still sounding). In `Awaiting` it relocks the cards for `inputLockMs`; in `CorrectionTap` it does not lock. It increments the trial's `replayCount` once the chord can actually play (a replay that hits `AudioNeedsGestureError` is not counted), and has no effect on scoring. A replay pressed after a wrong answer comes after the trial row is written, so it is not saved.

**Persistence before UI.** `saveTrial` is awaited before the success pause and before `advanceTrial`. A trial is never advanced past without its row being written.

### Scoring

- `firstAnswerCorrect` is set from the **first** tap in `Awaiting` and never changes. It is the only accuracy metric; the dashboard and the advancement checklist derive from it.
- `firstAnswerChordId` records what was tapped.
- Each trial is written once, when the child first answers. `correctionIncomplete` and `correctionTapCount` are written as `false` and `0`; they carry meaning only on rows recorded when the correction was saved as a separate step.

### Two guards on the async chains

- `isMountedRef` — checked after every `await`. React StrictMode double-mounts in dev, and a stale chain must not write state.
- `isProcessingRef` — a synchronous re-entry lock. `setState` cannot provide this; a second tap can land between awaits.

### Completion

When `currentIndex + 1 >= trialsPerSession`, `saveTrial` itself marks the session `status: 'completed'`, `endReason: 'target_reached'`, and the screen moves to `Done`, which renders `PracticeDone`. This path respects the configured trial count (20 or 25).

### Exiting early

`HoldToExit` (1-second hold) calls `endSession(sessionId, 'parent_ended')` unless the state is `Done` or `Initializing`.

## Session lifecycle (`src/db.ts`)

```ts
status:    'active' | 'completed' | 'completed_short' | 'interrupted' | 'discarded'
endReason: 'target_reached' | 'parent_ended' | 'idle_timeout' | null
```

`SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000`.

`endSession` and `checkAndCloseStaleSessions` both classify through `closedStatusFor(session)` in `db.ts`:

| scoredTrialCount | status |
|---|---|
| `>= plannedTrialCount` | `completed` |
| `>= 20` | `completed_short` |
| `> 0` | `interrupted` |
| `0` | `discarded` |

Sessions that finish normally go through `saveTrial`, which sets `completed` directly. The stale sweep is one `modify` over the `status` index, narrowed to rows idle for ten minutes or more, so live rows are not rewritten.

`endedAt` is set to `lastActivityAt`, not to the time of closure, so an idle-timed-out session ends at its last real activity.

**The idle timeout is evaluated lazily.** There is no in-session timer. A session left open on screen stays `active` until the next time `Practice` mounts. `lastActivityAt` is bumped on trial start, replay, save, and advance.

## Timing constants

| What | Value | Where |
|---|---|---|
| Chord hold | Per profile: 1.5, 2, 3 or 4 s (default 1.5 s), velocity 0.65 | `config.chordDurationMs` → `resolvePlaybackTiming` → `audio.playChord` |
| Card lock after a chord starts | Per profile: 0.5, 1, 2 s or the whole chord (default 0.5 s; whole chord is stored as `null`); never longer than the chord | `config.inputLockMs` → `resolvePlaybackTiming` → `Practice.tsx` |
| Sampler release | 0.15 s | `audio.ts` constructor |
| Pause after correct | 850 ms | `Practice.tsx` |
| Wrong-guess note before the replay | 220 ms | `audio.ts` `MISS_TONE_MS` |
| Inter-trial pause | 350 ms | `Practice.tsx advanceTrial` |
| Intro pause after tap | 800 ms | `IntroMode.tsx` |
| Idle timeout | 10 min | `db.ts` |

