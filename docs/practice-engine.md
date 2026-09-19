# Practice engine

How a session runs, how trials are scored and stored, how sequences are generated, and how sessions end. Sources: `src/components/Practice.tsx`, `src/components/IntroMode.tsx`, `src/utils/scheduler.ts`, `src/db.ts`, `src/App.tsx`.

## Two modes, chosen by chord count

`App.tsx` forks the `'practice'` view on `config.activeChordIds.length`:

- **1 chord → `IntroMode`.** Unscored familiarisation.
- **2 or more → `Practice`.** Scored session.

There is no other mode. In particular there is no note-naming mode for Phase B and no isolated-note assessment.

## IntroMode (one chord, unscored)

1. On mount, records the start time. Nothing is written yet.
2. Speaks "Listen to the sound, then tap the card." and waits 400 ms.
3. Three steps. Each: play the chord, wait 2200 ms, speak the colour name ("Red"), enable the single card, show "Tap the Red card".
4. On tap: success chime, 800 ms, next step.
5. After the third tap, one `sessions` row is written already closed: `status: 'completed'`, `endReason: 'target_reached'`, `scoredTrialCount: 3`, `plannedTrialCount: 3`, `sequence: []`, with `startedAt` from step 1.

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

`TrialState` has ten members:

```
Initializing · NeedsResumeTap · Ready · Playing · Awaiting · Correct
Correcting · PlayingCorrection · CorrectionTap · Done
```

Input is accepted only in `Awaiting` and `CorrectionTap`. `Ready` is a 350 ms inter-trial pause that renders the grid with nothing in the status area.

**Normal trial**

```
Ready → Playing (chord plays; UI waits a hardcoded 2200 ms) → Awaiting
  correct tap → Correct (chime, trial saved, 850 ms) → advance
  wrong tap   → trial saved with correctionIncomplete: true
              → Correcting (speak "That was <Colour>", 300 ms)
              → PlayingCorrection (replay chord, 2200 ms)
              → CorrectionTap (only the target card is enabled)
  target tap  → same trial row re-put with correctionIncomplete: false → advance
```

**Replay.** A replay button is available in `Awaiting` and `CorrectionTap`. It replays the chord, increments the trial's `replayCount`, and has no effect on scoring. Replays before and after a wrong answer are merged into one count.

**Persistence before UI.** `saveTrial` is awaited before the success pause and before `advanceTrial`. A trial is never advanced past without its row being written.

### Scoring

- `firstAnswerCorrect` is set from the **first** tap in `Awaiting` and never changes. It is the only accuracy metric; the dashboard and the advancement checklist derive from it.
- `firstAnswerChordId` records what was tapped.
- `correctionIncomplete` is `true` between the wrong answer and the corrective tap, then `false`. A session abandoned mid-correction therefore leaves a truthful record.
- `correctionTapCount` is meant to count wrong taps during correction, but non-target cards are disabled in `CorrectionTap`, so it is always 0.

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

These are duplicated between `audio.ts` and the components. Change them together.

| What | Value | Where |
|---|---|---|
| Chord note hold | 1.5 s at velocity 0.65 | `audio.ts playChord` |
| Sampler release | 0.15 s | `audio.ts` constructor |
| UI wait after chord | 2200 ms | `Practice.tsx` (three places), `IntroMode.tsx` |
| Pause after correct | 850 ms | `Practice.tsx` |
| Pause after spoken label | 300 ms | `Practice.tsx` |
| Inter-trial pause | 350 ms | `Practice.tsx advanceTrial` |
| Intro pause after tap | 800 ms | `IntroMode.tsx` |
| Idle timeout | 10 min | `db.ts` |

`playChord` returns 2200 as a duration, but every caller ignores the return value and hardcodes the same literal.
