# Curriculum

The curriculum is the ordered `CHORDS` array in `src/chords.ts`. It is the app's most important piece of data. Everything below was read from that file on 9 September 2026.

## The 14 chords

| # | id | Colour shown to child | Hex | Notes | MIDI | Voicing (parent-facing) | Phase |
|---|---|---|---|---|---|---|---|
| 1 | `red` | Red | `#ef4444` | C4 E4 G4 | 60 64 67 | C major, root | A |
| 2 | `yellow` | Yellow | `#fde047` | C4 F4 A4 | 60 65 69 | F major, 2nd inversion (F/C) | A |
| 3 | `blue` | Blue | `#3b82f6` | B3 D4 G4 | 59 62 67 | G major, 1st inversion (G/B) | A |
| 4 | `black` | Black | `#171717` | A3 C4 F4 | 57 60 65 | F major, 1st inversion (F/A) | A |
| 5 | `green` | Green | `#22c55e` | D4 G4 B4 | 62 67 71 | G major, 2nd inversion (G/D) | A |
| 6 | `orange` | Orange | `#f97316` | E4 G4 C5 | 64 67 72 | C major, 1st inversion (C/E) | A |
| 7 | `purple` | Purple | `#a855f7` | F4 A4 C5 | 65 69 72 | F major, root | A |
| 8 | `pink` | Pink | `#f472b6` | G4 B4 D5 | 67 71 74 | G major, root | A |
| 9 | `brown` | Brown | `#78350f` | G4 C5 E5 | 67 72 76 | C major, 2nd inversion (C/G) | A |
| 10 | `gray` | Gray | `#9ca3af` | A3 C♯4 E4 | 57 61 64 | A major, root | B |
| 11 | `tan` | Tan | `#d4a373` | D4 F♯4 A4 | 62 66 69 | D major, root | B |
| 12 | `lightgreen` | Light Green | `#86efac` | E4 G♯4 B4 | 64 68 71 | E major, root | B |
| 13 | `lightpurple` | Light Purple | `#d8b4fe` | B♭3 D4 F4 | 58 62 65 | B♭ major, root | B |
| 14 | `skyblue` | Sky Blue | `#38bdf8` | E♭4 G4 B♭4 | 63 67 70 | E♭ major, root | B |

Phase A is the nine white-key chords, three voicings each of C, F, and G major. Phase B is five black-key root-position chords. All `midiNotes` agree with their `notesWithOctave` strings.

The order, voicings, and colours of all 14 were checked against Sakakibara (2014), Figures 2 and 3 and Table 1, on 10 September 2026. They match exactly. See [method.md](method.md).

The pitch range used is MIDI 57 (A3) to 76 (E5). The lowest and highest notes are both in Phase A (Black and Brown).

## The data shape

Each entry is a `ChordDefinition` (`src/db.ts`):

```ts
interface ChordDefinition {
  id: string;                 // stable key, stored in config and trials
  order: number;              // 1..14, matches array position
  notesWithOctave: string;    // parent-facing, e.g. "C4–E4–G4"
  inversionDescription: string; // parent-facing, e.g. "C major, root position"
  midiNotes: number[];        // what the sampler plays
  displayIdentity: string;    // the colour word, the only identity the child sees
  colorHex: string;           // card colour
}
```

`CHORDS_MAP` indexes the array by `id`.

**"Phase" is not a field.** It exists only as two comments in the array (`// Initial nine chords (Phase A)` and `// Later black-key chords (Phase B)`). Nothing in the code branches on it. The parent guide reports "Phase B" when more than nine chords are active, but the practice screen treats chords 10 to 14 exactly like the first nine. See [decision-log.md](decision-log.md) D-009.

`inversionDescription` describes the single fixed voicing. There are no alternative inversions in the data or the code (D-024, not implemented).

## Invariants

1. **`config.activeChordIds` is always a prefix of `CHORDS` in array order.** `ParentDashboard.addChord` appends `CHORDS[activeChordIds.length]`; `removeLastChord` slices the last one off. Nothing else writes that array except `defaultConfig` (`['red']`), which seeds every new profile and is re-applied by `resetProfileData`.
2. **Never reorder or remove entries.** Doing so silently changes what every existing learner is practicing and what their stored trials mean. Append only.
3. **Never change a voicing, colour, or id of an introduced chord.** Trials store `presentedChordId`, so a changed voicing makes historical accuracy incomparable. If a change is ever unavoidable, it needs a curriculum version and a migration; neither exists today (D-029).
4. **Chord 1 is always Red and chord 2 is always Yellow**, by the prefix rule. Familiarisation is Red-only; scored practice begins with Red vs Yellow.

## Colour choices

Colours are Tailwind palette values chosen for mutual distinctness. Yellow is a bright lemon (`#fde047`); the mustard-yellow problem noted in early prototypes was resolved before Orange (`#f97316`) enters at chord 6. The closest remaining pairs are Tan (`#d4a373`) vs Brown (`#78350f`), and the three pastel Phase B colours (Light Green, Light Purple, Sky Blue) against their saturated Phase A siblings. Final hex values after on-device and colour-vision testing remain an open decision (see decision log).

## Where the curriculum is displayed

- **Child:** only `colorHex` (the card) and `displayIdentity` (spoken during intro and correction, and shown as "Tap Red" / "That was Red!"). Cards carry no text and no `aria-label`.
- **Parent:** the dashboard shows active swatches with colour names. The guide (section 6) lists all 14 with order, voicing, and note names, each tappable to preview the chord.
