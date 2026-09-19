# Child experience

What a pre-reading five-year-old sees and touches. Sources: `src/components/ChildHome.tsx`, `Practice.tsx`, `IntroMode.tsx`, `PracticeDone.tsx`, `HoldToExit.tsx`, `RotateDeviceOverlay.tsx`, `src/App.tsx`, `index.html`.

## Screens

**Home (`ChildHome`).** A 256 px round blue button with an ear icon and the word "Practice". Below it, four dots that fill green for each session completed today and the text "N of 4 sessions today". Top-left, a white chip with the active profile's colour dot, name, and a chevron that opens the profile switcher (see parent-experience.md). The dot is 12 px and uses a deep, low-chroma palette two steps darker than the chord colours, so it never resembles an answer card. Top-right, a small "Parents" pill (`aria-label="Parent Area"`) that leads to the parent gate. The count includes unscored intro sessions (see known issues).

**Intro (`IntroMode`, one chord).** One full-colour card, up to 280 px square, three progress dots, a listening indicator, and the text "Tap the Red card". Hold-to-exit top-left.

**Practice (`Practice`, two or more chords).** Hold-to-exit top-left, a status area (listening indicator, "That was Red!", "Listen to Red", "Tap Red", or the replay button), the card grid, and a strip of dots at the bottom, one per trial so far, green for a correct first answer and red for a wrong one.

**Done (`PracticeDone`).** A green check, a headline by accuracy (100% "Perfect score!", 80%+ "Amazing job!", 60%+ "Great effort!", else "Keep practicing!"), then "Final Score N / total", "X% Accuracy", and two rows of colour dots: "Nailed It" (per-chord accuracy ≥ 70%) and "Practice More". A "Go Home" button. After an intro it just says "Done!".

## The card grid

Card order is `activeChordIds` order and never changes within a level. Grid shape depends only on chord count:

| Active chords | Grid | Max width |
|---|---|---|
| 2 | 1 column × 2 rows | `max-w-sm` |
| 3–4 | 2 × 2 | `max-w-sm` |
| 5–6 | 2 × 3 | `max-w-sm` |
| 7–9 | 3 × 3 | `max-w-md` |
| 10–14 | 4 × 4 | `max-w-lg` |

Layout changes when the count crosses 2, 4, 6, or 9, which is the moment a new chord is introduced, so positions are stable within a level and move between levels. With 10 to 13 chords the last row of the 4×4 is partially filled.

Cards are `<button>` elements filled with `colorHex`, `rounded-[2rem]`, and an inline `minHeight: 72px`. They have **no text, no `aria-label`, and no `title`**, so nothing can leak the identity, and screen readers get nothing. In `Playing` all cards are at 40% opacity. In `CorrectionTap` the target card pulses with a ring and a pointing-hand emoji while every other card is dimmed to 10%, greyscaled, shrunk, disabled, and `pointer-events-none`.

### Target sizes

The decision log asks for a 72 px floor with 88 to 112 px preferred. The build has a 72 px **height** floor only. Width comes from the grid: at 4 columns inside `max-w-lg` with the padding and gaps used, a 375 px-wide screen gives roughly 74 px per card, which is marginal. Two child-reachable controls are below the floor: the hold-to-exit button (48 px) and the replay button (roughly 44 px tall). No 375 × 667 test exists.

## Viewport and orientation

- `App.tsx` wraps everything in `h-[100dvh] overflow-hidden`; `Practice` fills it with a flex column and `pb-[env(safe-area-inset-bottom)]`. There is no explicit height budgeting; the grid takes whatever is left between the top bar, a fixed-height status area, and the dot strip.
- `index.html` sets `maximum-scale=1.0, user-scalable=no, viewport-fit=cover`; `body` has `overscroll-none`.
- `RotateDeviceOverlay` compares `window.innerWidth > window.innerHeight` on mount and on `resize` and covers the whole app with "Please rotate your device" in landscape. It uses no orientation API. It also covers the parent screens.
- `public/manifest.json` requests `portrait-primary` and `display: standalone`.

## Exit

`HoldToExit` is a subdued 48 px grey circle with a door icon that requires a 1-second press-and-hold. It appears in both `Practice` and `IntroMode`. It is not adult-gated; a child who holds it for a second leaves the session. In `Practice` it ends the session as `parent_ended`; in `IntroMode` there is no row yet to end, since the intro writes its single `completed` row only when the three taps finish, so an abandoned intro leaves nothing behind. There is no pause, only exit.

## What the child hears

- Piano chords from the sampler.
- Spoken colour words during intro ("Red") and correction ("That was Red").
- The intro instruction "Listen to the sound, then tap the card."
- A two-note rising chime after a correct answer.
- Nothing after a wrong answer except the spoken label.

## Identity leak audit

Checked 9 September 2026. No note name, chord name, or the word "chord" appears in any child-facing rendered or spoken text. Colour words are the only identity, and they appear only where the method intends: during intro and during correction. Note names and voicings appear only in the parent guide behind the parent gate. The browser tab title ("Perfect Pitch Ear Training for Kids: Eguchi Method | Matt McInnis") is visible in a browser but hidden in standalone mode; the home-screen label is "Perfect Pitch". Neither names a note or chord.

## Feedback the child sees that the decision log did not intend

D-033 says analytics are adult-only. The child currently sees a numeric score, a percentage, an evaluative headline, a per-chord "Practice More" list, and red dots for each error during the session. None of it is punitive or competitive, but it is evaluative and it is not what the log decided. Recorded as a contradiction in [decision-log.md](decision-log.md); changing it is a product decision.

## Animation classes that do nothing

`animate-fadeIn` (onboarding) and `animate-spin-slow` (rotate overlay) are used but never defined. `src/index.css` is only `@import "tailwindcss"`. Both are no-ops.
