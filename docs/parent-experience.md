# Parent experience

Sources: `src/components/FirstRunOnboarding.tsx`, `ProfileCreateScreen.tsx`, `ProfileForm.tsx`, `ProfileSwitcher.tsx`, `ParentGate.tsx`, `ParentDashboard.tsx`, `ParentGuide.tsx`, `src/App.tsx`.

## Profiles

Before anything else on a fresh install, `ProfileCreateScreen` asks "Who will be practicing?" with a name field (labelled "Name", not "Child's name": an adult may be the learner; trimmed, whitespace-collapsed, at most 24 characters) and a row of eight colour swatches (`PROFILE_COLOURS` in `db.ts`, a radio group; the default is the first colour no existing profile uses) and a quiet **privacy notice** under the field (shield icon, two short lines): nothing leaves this device, no account or sign-in or sync, stored only in this browser, and clearing site data erases it. Above the heading sits a row of the nine Phase A chord colours, decorative and unnamed, so nothing is leaked to a child. `createProfile` writes the profile, its seed config, and the active pointer together.

The same form appears whenever a profile is added: from the switcher's "Add another profile" and from the dashboard's Profiles section. A newly created profile becomes active immediately. Onboarding is **not** re-run for it: the flag lives on the device-level `meta` row, so adding a sibling from the dashboard keeps the parent in the dashboard. A failed save (quota, database that would not open) shows an error under the form rather than failing silently.

`ProfileSwitcher` ("Who is practicing?") opens from the name chip top-left on the child home screen: one large button per profile, each with its colour dot, the active one outlined in its own colour, plus "Add another profile". It is not behind the parent gate; switching is harmless and the parent is meant to be nearby. Rename and delete are dashboard-only.

## First run

When `meta.hasCompletedOnboarding` is false, `App.tsx` shows `FirstRunOnboarding` and nothing else. It runs once per device, after the first profile is created, so screen 1 can use the child's name ("What Oliver will do"). Three steps with progress dots:

1. **What <name> will do** — Listen / Choose / Feedback tiles.
2. **What you will do** — "four short sessions throughout the day. Each session contains 25 sounds", "approx. 100 trials total", "2 to 5 minutes", "Calm, neutral supervision". The "25 sounds" text is static even if the trial count is later set to 20.
3. **How training begins** — Red-only intro, then Red and Yellow. Three finish buttons: "Introduce Red (Start Now)", "Show me the Quick Start", "Read the full method guide".

`finish()` calls `setOnboardingCompleted(true)`; the tap itself unlocks the audio through the engine's gesture listener (the first unlock on a fresh install). `App.tsx` maps the first button to the practice view and the other two to the parent view. "Quick Start" and "full guide" are not distinguished downstream; nothing deep-links into a guide section from onboarding.

## Parent gate

`ParentGate` is a 160 px round button that must be pressed and held for 1000 ms, completed by a 1000 ms timer in the shared `useHold` hook (also used by `HoldToExit`), with animation frames drawing the fill bar only. That split matters: a hidden tab runs no frames, so a hold completed from the frame loop never finished there. Releasing early, or sliding off the button, resets to zero. There is **no PIN** and no arithmetic challenge. A large "Back to Child Practice" button sits above it. The gate wraps `ParentDashboard`; the dashboard's own `subView` switches to `ParentGuide` or `SessionHistory`.

## Dashboard

### Information

| Item | How it is computed |
|---|---|
| Accuracy | Percentage of `firstAnswerCorrect` over the last 100 trials by `completedAtUtc`, all levels, all session statuses. Shows "—" with no trials. Labelled "first-answer". |
| Sessions today | Sessions with `startedAt` on or after local midnight and status `completed` or `completed_short`, shown as N/4. Intro sessions count. |
| Days at level | `max(1, floor((now − currentLevelStartedAtUtc) / day))`, sub-labelled "min 14 days". Reads 1 on day 0. |
| Active chords | "N of 14" with swatches and colour names. |
| Caution | "High chord accuracy indicates good training progress, but does not prove independent absolute pitch." |

The dashboard itself has no per-chord breakdown, confusion list, or replay rate, although guide section 7 mentions replay rate, confusions, and consistency as things to watch. Those appear per session in the session history below.

### Session history

"Session history" in the Recent Progress card opens `SessionHistory` (a dashboard `subView`, like the guide). Opening it first runs `checkAndCloseStaleSessions`, the same sweep `Practice` runs on mount, so a session abandoned more than ten minutes ago shows its closed status rather than "In progress". It lists the profile's sessions newest first, 40 at a time with "Show older sessions", skipping `discarded` rows; a page that would cut a day in half is extended to the whole of its oldest day, so each day's count is complete. Summaries come from `summariseSession` in `src/utils/sessionSummary.ts`.

- **First sound of each session** heads the screen: how many of the last 20 scored sessions had their first sound (`sequenceIndex` 0) answered right, a strip of those first sounds oldest to newest, and what guessing would score (the sum of 1/N over those sessions, N being the session's chord count). The first sound is the only one with no earlier chord to compare against. A session whose index-0 trial was never answered is left out. Beneath, under "By first chord" (a toggle that starts collapsed on every visit), the same sessions are broken down per chord: each chord that was the first sound at least once, in curriculum order, with its dot and name, a bar in its colour, and how many of those first sounds were answered right ("4 / 6"), drawn like the per-chord rows of an expanded session.
- Sessions are grouped by local day, each day headed "N of 4 sessions" using the same rule as Sessions Today.
- Each scored session shows its start time and status (Completed, Ended early for `completed_short`, Interrupted, In progress), with the chord set beneath the time: a dot per chord in curriculum order (from the distinct ids in the session's own `sequence`, so an old session shows its own level) and "N chords · newest X". Top right, side by side, are the two headline numbers: **First** (the first sound's chip, drawn as in the strip, then a dot in the practice screen's progress-strip colours, emerald for correct and rose for missed, with the word beneath; a dash if index 0 was never answered) and **Score** ("16 / 20" as `PracticeDone` shows it, with the percentage beneath). Below is a strip of every sound in order: solid in the chord's colour when correct, hollow with a cross when missed, dashed for planned sounds not reached. Duration is not shown.
- Tapping a session expands it: first-answer accuracy per chord (curriculum order), mix-ups grouped as "X played, chose Y ×n", how many times the Replay button was pressed, and a note if the session ended mid-correction.
- Intro sessions show as "Introduction to Red · heard 3 times · unscored". They have no trials; Red is the only chord an intro can be for, since active chords are a prefix of `CHORDS`.

Nothing here is shown to the child.

### Advancement checklist

Headed "Advancement Checklist (ALL required)" with a "Strict Rule" badge. Three items:

1. Days at level ≥ 14 — "Allows auditory memory consolidation (~56 sessions / 1,400 sounds)".
2. At least 100 trials and accuracy ≥ 95% over the last 100 trials.
3. Explicit parent approval — always rendered with a green check.

The checklist is **advisory**. "Introduce Next Chord (Colour)" is disabled only when all 14 chords are active. It calls `addChord`, which appends the next chord and resets `currentLevelStartedAtUtc`.

Note the mismatch with the decision log (D-022) and with guide section 7, both of which describe 100 *consecutive* correct first answers with balanced coverage. The dashboard implements a weaker rule and does not restrict the 100-trial window to the current level. Recorded in [decision-log.md](decision-log.md).

### Controls

- **Introduce Next Chord** — see above.
- **Step back one chord** — `window.confirm`, then slices the last id off and resets the level timestamp. Hidden at one chord.
- **Trials per session** — a toggle between 20 and 25.
- **Chord length** — 1.5, 2, 3 or 4 s (default 1.5 s): how long each chord is held, in practice, intro, correction and replay.
- **Lock the cards for** — 0.5, 1 or 2 s, or **Whole chord** (stored as `inputLockMs: null`). The default is 0.5 s. Options not shorter than the chosen chord are disabled. The copy explains that a short lock stops accidental taps, that after it the child can answer mid-chord and the tap stops the chord, and that untouched chords play to the end. Applies to scored practice only; the intro always plays the whole chord and then speaks the colour. Both settings are per profile and return to defaults on **Reset**.
- **Chord names on cards** — Off, Basic, or Full; default Off (`chordLabels: 'off' | 'basic' | 'full'`, absent means off). When not Off, every answer card in practice and the intro card carry a name derived from `chordName` in `src/chords.ts` by `chordLabel()`. Full is the slash chord ("C", "F/C", "G/B"), so every card is distinct; Basic drops the bass note ("C", "F", "G"), so the three inversions of each of C, F, and G share a name. The copy under the picker says so. The ink is near-black or white, whichever contrasts more with the card. Hidden on the target card while its correction pointer shows. Per profile; returns to Off on **Reset**. See D-038.
- **Play Test Chord** — plays C4 E4 G4 (a literal `[60, 64, 67]`, equivalent to Red) at the profile's chord length and speaks "Red" when it ends.
- **Profiles** section — lists every profile with the active one ticked. Tapping a name switches (`setActiveProfile`) without leaving the dashboard, and every card above re-reads for the new profile. Pencil swaps the row for the inline form with the name and colour pre-filled (no privacy notice, same 24-character limit; `updateProfile`); bin deletes via `window.confirm` (`deleteProfile`, which removes that profile's sessions, trials, and config and, if it was active, returns to the home screen or the switcher). "Add another profile" shows the inline `ProfileForm` with the privacy notice.
- **Export <name>'s Backup (JSON)** — downloads `eguchi-backup-<name>-YYYY-MM-DD.json` containing `{ schema_version: 2, exported_at_utc, profile, config, sessions, trials }` for the active profile only. There is **no import** and **no CSV**.
- **Replay Onboarding Screens** — `setOnboardingCompleted(false)` on the device-level meta row.
- **Reset <name>'s Practice Data** — `window.confirm`, then `resetProfileData`: deletes that profile's sessions and trials and re-puts its config from `defaultConfig` (`trialsPerSession: 20`). Other profiles, and the onboarding flag, are untouched.
- Links: Quick Start, Mistake Scripts, "How progress is measured", "Why am I waiting?" deep-link into guide sections. "Back to Child Practice".
- Footer: "Acoustic piano samples from Salamander Grand Piano V3 by Alexander Holm, licensed under CC BY 3.0."

## Guide

`ParentGuide` opens with a contextual stage card keyed to the active chord count: "Red Introduction", "Red & Yellow (2 Chords)", a plateau message for 5 to 7 chords, and for more than nine chords "Phase B: N Chords (Black-key chords) — Listen to and verify the child's spoken component note names." **The app has no note-naming mode**; this card describes behaviour that does not exist. See known issues.

Thirteen collapsible sections, only the first (or a deep-linked one) open by default:

1. Quick Start — "Your job today", what not to do, a live "Today's Current Setup" card, a Start Practice button. This is the TL;DR in function, though not labelled as one.
2. The 15-second explanation
3. What happens during a trial
4. How to respond to mistakes — the script "That was Yellow." and phrases to avoid
5. The daily routine
6. How chords are introduced — the full 14-chord list with voicings and note names, each tappable to preview
7. What progress means
8. Plateaus are expected
9. Later stages (Phase B)
10. Timeline and commitment
11. Research and limitations — citations and hedges; see [method.md](method.md) for wording that should stay conservative
12. What this method does not replace
13. When should we pause?

External links (three, all `target="_blank" rel="noreferrer"`) are the only outbound URLs in the app.
