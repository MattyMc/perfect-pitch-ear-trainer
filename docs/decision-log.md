# Decision log

Binding product decisions, each with its **implementation status** as verified against the code on 9 September 2026. Status values are defined in [README.md](README.md). Update the status when the code changes; change the decision only deliberately, and say why.

## Active decisions

| ID | Decision | Classification | Status | Evidence / gap |
|---|---|---|---|---|
| D-001 | Named local profiles per installation; no login or cloud identity | Product boundary | Implemented | Revised 19 September 2026 from "one child per installation". `profiles` table, `config` keyed by profile id, `profileId` on every session and trial; no network calls anywhere in `src/`. See D-036. |
| D-002 | Child practice is portrait-only | Interface aid | Implemented | `RotateDeviceOverlay` in both `App` branches; manifest `portrait-primary`. |
| D-003 | 375 × 667 is the smallest fully supported practice viewport | Product boundary | Not implemented | Nothing checks, tests, or budgets for it. The 4-column grid is marginal there. |
| D-004 | Child targets have a 72 × 72 px floor; 88–112 preferred | Interface aid | Partial | Cards have `minHeight: 72px` only. Hold-to-exit is 48 px; replay button is smaller than 72 px. |
| D-005 | All active cards remain visible and stable within a level | Reported method + interface aid | Implemented | Grid order is `activeChordIds`; shape is a pure function of count. Cards are heavily dimmed, not hidden, during correction. |
| D-006 | Red-only use is unscored familiarisation; testing begins with Red and Yellow | Operational definition | Implemented | `App.tsx` forks on `length === 1` to `IntroMode`, which writes no trials. Side effect in known-issues (intro sessions count as sessions). |
| D-007 | The exact 14 chord voicings, colours, and order are immutable curriculum data | Reported method | Implemented as data | `src/chords.ts`. Verified against Sakakibara (2014) Figures 2–3 and Table 1. Immutable by convention only: no version, fixture, or runtime guard. |
| D-008 | Phase A exposes only colour identities to the child | Reported method | Implemented by default | Only `displayIdentity` and `colorHex` reach child screens or speech. Cards carry no text or aria-label. Applies to all 14 chords, not just Phase A. A parent can opt out per profile; see D-038. |
| D-009 | Phase B begins after nine-white-chord mastery and switches responses to component note names | Reported method | **Not implemented** | No phase concept in code. Chords 10–14 are colour cards in a 4×4 grid. The parent guide describes note-naming as if it existed. |
| D-010 | No microphone or speech recognition; adult confirms Phase B responses | Product boundary | Implemented (first half) | No mic anywhere. There is no Phase B UI for the adult to confirm in. |
| D-011 | Isolated notes are separate assessments, not acquisition drills | Reported-method interpretation | Not implemented | No isolated-note mode exists. Nothing is mixed into sessions either. |
| D-012 | Default dose is four sessions of 20 trials, optional fifth; 20–25 qualifies | Reported method + product default | Partial | Default lowered from 25 to 20 on 28 September 2026. `defaultConfig()` seeds 20 for every new profile and on reset; existing profiles keep what they had. Picker offers 20 or 25. Home shows exactly four target dots; no fifth-session affordance. Onboarding text hardcodes "20 sounds". |
| D-013 | Sessions should be distributed; no make-up marathons | Reported-method interpretation | Not implemented | No spacing, cooldown, or daily cap. |
| D-014 | Balanced randomised queues replace adaptive weighting | Operational definition | Implemented | `generateSessionSequence`: counts differ by at most one; Fisher–Yates shuffle; no weighting. |
| D-015 | Red is never hard-coded as the first chord | Operational definition | Implemented | Opener is whatever the shuffle produces. |
| D-016 | No more than two identical consecutive stimuli or session openers | Operational definition | Partial | Within a session: rejects three in a row, up to 100 reshuffles, then returns the last shuffle unvalidated. Openers across sessions: not constrained. |
| D-017 | The first valid answer is immutable and determines accuracy | Reported method + scoring definition | Implemented | `firstAnswerId` set once in `Awaiting`; correction re-puts the row with `firstAnswerCorrect: false`. |
| D-018 | Incorrect responses receive an immediate neutral label, replay, and required correction tap | Reported method | Implemented | Speak "That was X" → 300 ms → replay → target-only tap. Non-target cards disabled, so `correctionTapCount` is always 0. |
| D-019 | Replay is allowed and tracked but not automatically wrong | Operational definition | Implemented | Replay button in `Awaiting` and `CorrectionTap`; `replayCount` persisted; no scoring effect. |
| D-020 | Ten minutes of inactivity ends an in-progress session | Operational definition | Implemented, lazily | `SESSION_IDLE_TIMEOUT_MS`; evaluated only when `Practice` mounts. No in-session timer. |
| D-021 | 20–24 trials closed by timeout or exit are `completed_short`; 1–19 are `interrupted` | Reported range + operational definition | Implemented | `closedStatusFor(session)` in `db.ts`: reaching `plannedTrialCount` is `completed`, 20 or more is `completed_short`, 1–19 `interrupted`, 0 `discarded`. Used by `endSession` and the stale sweep. |
| D-022 | Advancement requires 14 days, 100 consecutive correct first answers, per-chord and per-session coverage, integrity, and parent approval | Reported method (two weeks, 100% accuracy) + operational definition (100 consecutive, coverage) | **Contradicted** | The paper requires two weeks and 100% on the current set. The dashboard checks ≥ 95% over the last 100 trials, not filtered to the current level, with no coverage or integrity checks. Guide section 7 promises the stricter rule. Decide which is right and align code, guide, and this row. |
| D-023 | Advancement is never automatic | Product decision | Implemented | Only the dashboard button adds a chord; disabled only at 14. |
| D-024 | Optional black-chord inversions are adult-selected only after persistent difficulty | Reported method | Not implemented | No inversion data or mode. `inversionDescription` labels the single fixed voicing. |
| D-025 | One consistent acoustic-piano timbre; A4 = 440 Hz | Reported setup + implementation decision | Implemented | One `Tone.Sampler`; Tone default tuning. |
| D-026 | `Tone.Sampler` is the audio implementation | Implementation decision | Implemented | tone 15.1.22. |
| D-027 | Seven locally hosted Salamander files; nearest-note repitching of at most one semitone | Implementation decision | Implemented, unenforced | Verified: every curriculum pitch is 0 or 1 semitone from a sample. Nothing in code asserts it. |
| D-028 | One persistent Sampler; `Tone.start()`; loading gate; `Tone.now()` without offset; Draw scheduling; no Transport or effects | Implementation decision | Partial | All true except `Tone.Draw`, which is not used; UI timing is `setTimeout(2200)`. The success chime still uses `Tone.now() + 0.05`. |
| D-029 | Audio, curriculum, and app versions cannot change mid-session | Integrity rule | Not implemented | Sessions store no version stamp of any kind. `package.json` version is `0.0.0`. |
| D-030 | IndexedDB stores records; Cache Storage stores immutable assets | Implementation decision | Partial | IndexedDB yes. No service worker or Cache Storage; no offline. |
| D-031 | JSON backup, replace-import, and CSV analysis export are required | Product decision | Partial | JSON export only. No import, no CSV. |
| D-032 | No ads, third-party behavioural analytics, microphone, AI coaching, or child surveillance | Product boundary | Implemented | Grep-clean. The unused `@google/genai` dependency and `metadata.json` have been removed. |
| D-033 | Analytics are adult-only and never label chord mastery as "perfect pitch achieved" | Evidence/UX rule | **Contradicted** (first half) | Wording is careful. But `PracticeDone` shows the child a score, percentage, and "Practice More" list, and the in-session dot strip shows errors in red. |
| D-034 | Parent guide begins with a concise TL;DR and continues with complete detail | Product decision | Partial | Section 1 "Quick Start" is open by default and acts as the TL;DR, but is not labelled as one and is action-oriented rather than a method summary. |
| D-035 | Salamander samples may be used in a closed-source app with CC BY attribution and a third-party carve-out | Licence decision | Implemented | Attribution in the dashboard footer and in `THIRD_PARTY_NOTICES.md`. |
| D-037 | Chord length and the card lock are per-profile parent settings. The default is a 1.5 s chord with a 0.5 s lock, so by default the child can answer mid-chord and the tap cuts the chord off; "Whole chord" restores the original stimulus | Method deviation when the lock is shorter than the chord (the stimulus can be cut short), which includes the default; interface aid otherwise (28 September 2026) | Implemented | `resolvePlaybackTiming` in `src/utils/playbackTiming.ts`; `PlaybackTimingSettings` in the dashboard; `AudioEngine.stopChord`. "Whole chord" is stored as `inputLockMs: null`; an absent value means the 0.5 s default, so profiles that never touched the setting moved to it. The intro ignores the lock. Covered by `npm test`. |
| D-038 | A per-profile, off-by-default parent setting prints each chord's name on its card, as either the basic name ("F", simpler for children, but three cards share each of C, F, and G) or the full slash name ("F/C", every card distinct) | Method deviation when on (the child sees a chord name, against D-008); off by default so the method holds unless a parent chooses otherwise (29 September 2026) | Implemented | `chordLabels: 'off' \| 'basic' \| 'full'` on the config row, absent means off; `chordName` (full) on each `CHORDS` entry, the basic name derived by `chordLabel()`; three-way picker in the dashboard's session settings. Labels render in `Practice` and `IntroMode` in whichever of near-black or white contrasts more with the card (`labelInkFor`). Names are shown, never spoken. Covered by `npm test`. |
| D-036 | Profiles are a name and a colour dot and nothing more (the colour comes from a deep, low-chroma palette two steps darker than the answer cards so it reads as UI rather than a card, and is never spoken or shown card-sized, so D-008 holds); every record is scoped to one profile; creating a profile states that nothing leaves the device; switching is one tap from the child home screen | Product decision (19 September 2026) | Implemented | `ProfileCreateScreen` / `ProfileForm` carry the privacy notice; `ProfileSwitcher` opens from the name chip on `ChildHome`; rename, delete, reset, and export are per profile in the dashboard. Onboarding runs once per device, not per profile. A pre-profile install migrates into a profile named "My child" for the parent to rename. |
| D-039 | Sound plays through the iPhone's silent switch: the app claims Safari's `'playback'` audio session, as music apps do, rather than detect the switch, which a page cannot read. The cost is that practice pauses other audio, such as music, on the phone | Implementation decision (29 September 2026) | Implemented, untested on a device | An inline script in `index.html` sets `navigator.audioSession.type = 'playback'` before Tone creates its first context; `AudioEngine.rebuildContext` calls `claimPlaybackAudioSession()` before each new one. Safari 16.4+ only; older iOS is still muted by the switch (no silent-loop fallback, which would add lock-screen media controls). Whether Web Speech obeys the switch is unchecked. Unit-tested with a stubbed `navigator.audioSession`; not yet confirmed on an iPhone. See known-issues. |

## Superseded or rejected directions

| Earlier direction | Current decision | Status in code |
|---|---|---|
| Query the child repeatedly when only Red is active | Red-only activity is unscored guided familiarisation | Implemented (`IntroMode`). |
| Show two similar ear symbols | One unambiguous listening/replay system | Ambiguous. One ear icon means "start" on the home screen and "listening now" in practice; replay uses a separate rotate icon. Acceptable, but not the single system described. |
| Prominent child-facing X exit | Subdued parent-controlled pause/exit | Mostly implemented. `HoldToExit` is subdued and needs a 1-second hold, but is not adult-gated and there is no pause. |
| Map every target pitch to a Tone CDN filename | Map only real local files; let Sampler repitch | Implemented. |
| Require 18 direct source samples | Optional only if 18 genuine licensed recordings are acquired | Not pursued. Seven samples. |
| Forbid all runtime pitch shifting | Nearest-note repitching, maximum one semitone | Implemented (unenforced). |
| Use `Tone.now() + 0.05` | Use `Tone.now()` | Implemented for chords; the chime still adds 0.05. |
| Infer a new session from app launch/reload | Persisted session state and ten-minute inactivity | Implemented. |
| Ambiguous resume choice after termination | Under ten minutes resumes; ten or more closes and classifies | Implemented via `NeedsResumeTap`. |
| Yellow prototype's mustard/orange palette | Redesign Yellow distinctly before Orange is taught | Implemented. Yellow is `#fde047`, Orange `#f97316`. |

## Explicit non-goals for this release

- Accounts, passwords, or cloud sync.
- Teacher or classroom portals.
- Leaderboards, currencies, badges, streaks, or social sharing.
- Adaptive chord weighting.
- Alternate instruments, tunings, transposition, or timbres during acquisition.
- General music theory, interval, scale, or chord-quality lessons in Phase A.
- Isolated-note drilling mixed into ordinary chord sessions.
- Automatic progression or chord removal.
- Microphone recording, speech recognition, AI coaching, or remote analytics.
- Native app-store wrapper and push notifications.

## Open decisions

Still unresolved. Do not resolve these silently in code; record the decision here with its rationale.

1. **Advancement rule.** Keep the dashboard's "95% over last 100" or implement the spec's "100 consecutive correct with coverage"? Either way, restrict the window to the current level and make the guide match.
2. **Phase B.** Build a note-naming mode, or remove the Phase B language from the guide and treat chords 10 to 14 as more colour cards indefinitely?
3. **Child-facing results.** Keep the end-of-session score and percentage, soften it, or remove it per D-033?
4. **Offline.** Add a service worker, or drop the offline promise from the product contract?
5. **Import and CSV.** Build them, or downgrade D-031 to "JSON export only".
6. Final colour hex values after on-device and colour-vision testing.
7. Minimum supported iOS/Safari version.
8. Recorded voice versus Web Speech synthesis; vocabulary; localisation.
9. Whether to add isolated-note assessment as a separate, hint-free mode.
10. Whether Phase B remains usable at 375 × 667 if it is built.
