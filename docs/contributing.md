# Contributing

Rules for changing this app without breaking the method or the data. Toolchain mechanics (Node version, ports, base path, deploy) are in `CLAUDE.md` at the repository root; read that first. This page is about behaviour.

## Before changing behaviour

1. **Read the topic doc for the subsystem**, then the matching rows in [decision-log.md](decision-log.md). Do not infer intended behaviour from UI labels or from the parent guide's prose; the guide currently describes at least one feature that does not exist.
2. **Classify the change.** Is it a reported-method rule, an operational definition, an interface aid, or a method deviation? Deviations must be labelled wherever they surface, including the parent guide.
3. **Check [known-issues.md](known-issues.md).** Several issues interact (intro sessions, session classification, the seed/reset mismatch). Fixing one in isolation can move the problem.

## Hard rules

- **Never reorder, remove, or edit an introduced entry in `CHORDS`.** Append only. Every learner's `activeChordIds` is a prefix of that array and every trial stores a chord id.
- **The first answer is the score.** Nothing after the first tap in `Awaiting` may change `firstAnswerCorrect`.
- **Persist before advancing.** `saveTrial` is awaited before any UI advance. Keep it that way; recovery relies on it.
- **No note or chord names to the child.** Colour words only, and only where the method places them: the intro and the correction. Check every new child-facing string and every `aria-label`.
- **Advancement stays manual.** The dashboard button is advisory-gated at most; never disable it on the checklist and never add a chord automatically.
- **No new identity cues.** No adaptive weighting, no forced opener, no per-chord sounds or animations that differ by chord.
- **Local only.** No network requests, no storage outside IndexedDB, no analytics. If a feature needs the network, that is a product decision to record first.
- **Keep research claims conservative.** Chord mastery is not "perfect pitch". See [method.md](method.md) for phrasing that already needs softening; do not add more.
- **Asset URLs come from `import.meta.env.BASE_URL`.** Never a root-absolute literal.
- **Ids come from `newId()`**, not `crypto.randomUUID()` directly.

## Things that move together

- The chord-length and card-lock options in `src/utils/playbackTiming.ts` and the dashboard copy in `PlaybackTimingSettings.tsx` that explains them.
- Session-status thresholds in `db.ts` and `trialsPerSession` options in the dashboard.
- `defaultConfig()` in `db.ts`, which seeds every new profile (`createProfile`), every reset (`resetProfileData`), and the v3 migration fallback.
- The advancement checklist in the dashboard, guide section 7, and decision D-022.
- Any Dexie schema change and a new `this.version(n)` block.
- Any new dependency or shipped asset and `THIRD_PARTY_NOTICES.md`.

## Verification

`npm test` runs Vitest (jsdom, React Testing Library) over `src/**/*.test.{ts,tsx}`. The tests cover playback timing: `resolvePlaybackTiming`, `AudioEngine.playChord`/`stopChord` with Tone mocked, `Practice`'s card lock and tap-to-stop under fake timers with `db` and `audio` mocked, and the dashboard's timing controls. `npm run lint` first checks that `package-lock.json` satisfies `npm ci` (`check:lockfile`, a dry run), then runs `tsc --noEmit` over everything, tests included. `strict` is on with zero errors; keep it there without `any` or non-null assertions. There is no ESLint, and the deploy workflow runs lint but not the tests.

`npm run verify` runs lint, the tests and the build, and a pre-push hook (`.githooks/pre-push`, enabled by `npm install`) runs it against the tip of each pushed ref in a clean worktree, using the Node from `.nvmrc`. A push that would fail the deploy therefore fails locally first. `git push --no-verify` skips it.

The tests don't reach Dexie, real audio, or most screens, so still verify behaviour by hand in a narrow portrait viewport (the app blanks in landscape). At minimum after a change to the practice loop: a correct answer, a wrong answer through the full correction, a replay, hold-to-exit mid-session, and a resume within ten minutes.

## Updating the docs

- Behaviour change → update the topic doc and the decision's status row in the same commit.
- Fixed a known issue → delete its entry.
- New product decision → new D-number, classification, rationale, status.
- Dependency or asset change → `THIRD_PARTY_NOTICES.md`.
- Name files and functions rather than line numbers.

If a requested change conflicts with a decision in the log, say so and get the decision changed rather than quietly picking one.
