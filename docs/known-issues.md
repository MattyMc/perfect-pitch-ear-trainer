# Known issues

Bugs and inconsistencies confirmed in the code on 9 September 2026. None is fixed yet. Delete an entry when its fix lands. Where an item interacts with another, both are noted; check before "fixing" one in isolation.

## Bugs

1. **Intro sessions count as real sessions.** `IntroMode` marks its row `completed` with `scoredTrialCount: 3` although it writes no trials. `ChildHome` ("N of 4 sessions today") and the dashboard both count it.

2. **Advancement accuracy window spans levels.** The dashboard takes the last 100 trials globally, so trials from before the most recent `addChord` count toward the current level's 95%. The guide also promises a stricter rule (100 consecutive correct) than the dashboard computes. See decision log D-022.

3. **Unhandled audio-load failures outside `Practice`.** `IntroMode`, `ChildHome`, `FirstRunOnboarding`, `ParentDashboard`, and `ParentGuide` call `audio.init()` without try/catch. `Practice` is the only caller with an error screen. `IntroMode` would sit on its listening indicator indefinitely.

4. **`correctionTapCount` is dead.** Non-target cards are disabled during `CorrectionTap`, so the increment never runs and the field is always 0.

5. **Scheduler falls back silently.** After 100 rejected shuffles `generateSessionSequence` returns the last, possibly invalid, sequence. Realistically only reachable with two chords and a small trial count.

6. **Success-chime oscillators are never disposed.** Two `Tone.Oscillator` nodes leak per correct answer.

## Spec-versus-code gaps that read as bugs to a parent

7. **Guide describes a Phase B that does not exist.** The stage card and section 9 tell the parent to verify spoken note names once more than nine chords are active. The practice screen shows a 4×4 colour grid. See decision log D-009.

8. **Child sees a score.** `PracticeDone` shows "Final Score", a percentage, and a "Practice More" colour list; the practice screen shows red dots for errors. The decision log (D-033) says analytics are adult-only.

9. **No backup import.** The dashboard exports JSON but cannot import it.

10. **No offline support** despite installable-PWA manifest settings. See data-and-privacy.md.

## Cosmetic and hygiene

11. **`animate-fadeIn` and `animate-spin-slow` are undefined.** Used in `FirstRunOnboarding` and `RotateDeviceOverlay`; `src/index.css` defines no keyframes. Both are no-ops.

12. **Onboarding outcomes collapse.** `FirstRunOnboarding` can finish with `'quickstart'` or `'guide'`, but `App.tsx` sends both to the parent dashboard. Nothing deep-links into a guide section from onboarding.

13. **Timing literals are duplicated.** The 2200 ms post-chord wait is hardcoded in `Practice.tsx` (three places) and `IntroMode.tsx`; `playChord`'s return value is ignored. The dashboard's test button speaks "Red" at 1200 ms, while the chord is still sounding.

14. **Dead dependencies.** `@google/genai`, `express`, `dotenv`, `idb`, `motion`, `@types/express`, `autoprefixer`, and `tsx` are declared but unused. `metadata.json` declares a Gemini capability. `bun.lock` sits beside `package-lock.json`.

15. **Target sizes below the 72 px floor.** Hold-to-exit is 48 px; the replay button is under 72 px tall; cards have a height floor but no width floor. See child-ux.md.

16. **Cards have no accessible name.** Deliberate, to avoid leaking the answer, but it means the practice grid is silent to assistive technology. If an accessible label is ever added it must not contain the colour.

17. **Guide wording overreaches or misstates the paper.** Verified against Sakakibara (2014) on 10 September 2026: "C3 to B5" is not in the paper; the criterion is 100%, not "near-perfect"; "1.5 to 2 years" describes the chord stages, while reaching the isolated-note criterion took a median of about four years. Editorial phrases to soften: "landmark", "deep neurological consolidation", "demonstrate critical-period plasticity", "two distinct chord timbres". See method.md.
