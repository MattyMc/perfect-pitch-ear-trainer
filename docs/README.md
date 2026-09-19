# Documentation

**Last verified against the code:** 9 September 2026 (commit `30208cc`). Research figures verified against Sakakibara (2014) on 10 September 2026.

This directory describes Matt McInnis' Perfect Pitch Ear Training for Kids, the Eguchi chord-colour trainer, as it is **actually built**, and records the product decisions behind it. It grew out of a research-and-specification pass done before the code existed; that spec has been reconciled against the source and reshaped. Where the spec and the code disagree, these docs say so rather than describing the intended behaviour as if it shipped.

`CLAUDE.md` at the repository root covers the toolchain (Node version, dev port, base path, deployment). These docs cover the product, the method, and the behaviour.

## Where to start

| Need | Read |
|---|---|
| The method, its evidence, and how conservative to be about claims | [method.md](method.md) |
| The exact 14 chords, colours, voicings, and ordering invariants | [curriculum.md](curriculum.md) |
| Sessions, trials, scoring, correction, scheduling, timeouts | [practice-engine.md](practice-engine.md) |
| Tone.js, the piano samples, timing, speech | [audio.md](audio.md) |
| What the child sees and touches | [child-ux.md](child-ux.md) |
| Onboarding, the parent gate, the dashboard, advancement, the guide | [parent-experience.md](parent-experience.md) |
| IndexedDB schema, export, privacy, offline status | [data-and-privacy.md](data-and-privacy.md) |
| Every product decision with its implementation status | [decision-log.md](decision-log.md) |
| Bugs and inconsistencies found in the code, not yet fixed | [known-issues.md](known-issues.md) |
| Rules for changing the app without breaking the method | [contributing.md](contributing.md) |
| Licences for shipped third-party assets and libraries | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |

## Status vocabulary

Every behavioural claim in these docs is one of:

- **Implemented** — the code does this. File and function names are given so it can be re-checked.
- **Partial** — the code does some of it. The gap is stated.
- **Not implemented** — a decision or spec item with no code behind it. Kept because it is still the intent, or because it explains why something is absent.
- **Contradicted** — the code does something different from the decision. Either the code or the decision needs to change; the docs do not pick silently.

## Rule classification

Training rules carry one of four labels, so that operational choices are never mistaken for the published method:

- **Reported method** — directly described in the published Eguchi / Sakakibara procedure.
- **Operational definition** — a product rule needed where the publication is imprecise (e.g. what counts as a completed session).
- **Interface aid** — improves operation without changing the auditory task (e.g. portrait lock, card size).
- **Method deviation** — changes the stimulus, response, spacing, progression, or feedback. Must be labelled as such wherever it appears.

## Product contract

These hold in the current build and should not be changed without revising the decision log:

- Any number of named local profiles per installation, each with its own curriculum position and history. A profile is a display name only: no login, no account, no network requests. All records stay in the browser's IndexedDB, and the profile creation screen says so.
- Portrait-only child practice.
- All active answer cards are visible at once and keep their positions within a level.
- One active chord is unscored familiarisation (`IntroMode`). Scored practice begins at two chords.
- The 14 chords, their voicings, colours, and order are fixed data. New chords are appended, never reordered.
- Chords are presented in a balanced, shuffled bag. Red is never forced to open a session.
- The first answer determines the trial's accuracy. A correction never rewrites it.
- A wrong answer gets an immediate, neutral spoken label, a replay, and a required tap on the correct card.
- Advancement is never automatic. The parent introduces every new chord.
- The child never sees a note name or chord name. Only colour names appear or are spoken.
- No advertising, third-party analytics, leaderboards, punitive feedback, adaptive drilling, or microphone use.

## Where the spec and the code still disagree

Summarised here; details in [decision-log.md](decision-log.md) and [known-issues.md](known-issues.md).

- **Advancement criterion.** The spec says 100 consecutive correct first answers with per-chord coverage. The dashboard checks 95% or better over the last 100 trials, unfiltered by level.
- **Phase B.** The spec switches the child to naming component notes after nine chords. The code has no such mode; chords 10 to 14 are more colour cards in a 4×4 grid, while the parent guide describes note-naming as if it existed.
- **Offline.** The spec calls for a service worker and Cache Storage. There is none; the app needs a network connection on every launch.
- **Backup.** The spec requires JSON export, JSON import, and CSV export. Only JSON export exists.
- **Child-facing analytics.** The spec says analytics are adult-only. The end-of-session screen shows the child a score, a percentage, and a "Practice More" colour list.
- **Version stamping.** The spec forbids changing audio, curriculum, or app version mid-session. Sessions record none of these.

## Maintaining these documents

When behaviour changes, update the topic document and the matching entry in `decision-log.md` in the same commit. When a known issue is fixed, delete it from `known-issues.md`. When a dependency or shipped asset changes, update `THIRD_PARTY_NOTICES.md`. Prefer naming files and functions over quoting line numbers; line numbers rot.
