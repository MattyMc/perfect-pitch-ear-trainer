import { ChordDefinition } from './db';

export const CHORDS: ChordDefinition[] = [
  // Initial nine chords (Phase A)
  { 
    id: 'red', 
    order: 1, 
    notesWithOctave: 'C4–E4–G4',
    inversionDescription: 'C major, root position',
    midiNotes: [60, 64, 67], 
    displayIdentity: 'Red', 
    colorHex: '#ef4444' 
  },
  { 
    id: 'yellow', 
    order: 2, 
    notesWithOctave: 'C4–F4–A4',
    inversionDescription: 'F major, second inversion (F/C)',
    midiNotes: [60, 65, 69], 
    displayIdentity: 'Yellow', 
    colorHex: '#fde047' 
  },
  { 
    id: 'blue', 
    order: 3, 
    notesWithOctave: 'B3–D4–G4',
    inversionDescription: 'G major, first inversion (G/B)',
    midiNotes: [59, 62, 67], 
    displayIdentity: 'Blue', 
    colorHex: '#3b82f6' 
  },
  { 
    id: 'black', 
    order: 4, 
    notesWithOctave: 'A3–C4–F4',
    inversionDescription: 'F major, first inversion (F/A)',
    midiNotes: [57, 60, 65], 
    displayIdentity: 'Black', 
    colorHex: '#171717' 
  },
  { 
    id: 'green', 
    order: 5, 
    notesWithOctave: 'D4–G4–B4',
    inversionDescription: 'G major, second inversion (G/D)',
    midiNotes: [62, 67, 71], 
    displayIdentity: 'Green', 
    colorHex: '#22c55e' 
  },
  { 
    id: 'orange', 
    order: 6, 
    notesWithOctave: 'E4–G4–C5',
    inversionDescription: 'C major, first inversion (C/E)',
    midiNotes: [64, 67, 72], 
    displayIdentity: 'Orange', 
    colorHex: '#f97316' 
  },
  { 
    id: 'purple', 
    order: 7, 
    notesWithOctave: 'F4–A4–C5',
    inversionDescription: 'F major, root position',
    midiNotes: [65, 69, 72], 
    displayIdentity: 'Purple', 
    colorHex: '#a855f7' 
  },
  { 
    id: 'pink', 
    order: 8, 
    notesWithOctave: 'G4–B4–D5',
    inversionDescription: 'G major, root position',
    midiNotes: [67, 71, 74], 
    displayIdentity: 'Pink', 
    colorHex: '#f472b6' 
  },
  { 
    id: 'brown', 
    order: 9, 
    notesWithOctave: 'G4–C5–E5',
    inversionDescription: 'C major, second inversion (C/G)',
    midiNotes: [67, 72, 76], 
    displayIdentity: 'Brown', 
    colorHex: '#78350f' 
  },

  // Later black-key chords (Phase B)
  { 
    id: 'gray', 
    order: 10, 
    notesWithOctave: 'A3–C♯4–E4',
    inversionDescription: 'A major, root position',
    midiNotes: [57, 61, 64], 
    displayIdentity: 'Gray', 
    colorHex: '#9ca3af' 
  },
  { 
    id: 'tan', 
    order: 11, 
    notesWithOctave: 'D4–F♯4–A4',
    inversionDescription: 'D major, root position',
    midiNotes: [62, 66, 69], 
    displayIdentity: 'Tan', 
    colorHex: '#d4a373' 
  },
  { 
    id: 'lightgreen', 
    order: 12, 
    notesWithOctave: 'E4–G♯4–B4',
    inversionDescription: 'E major, root position',
    midiNotes: [64, 68, 71], 
    displayIdentity: 'Light Green', 
    colorHex: '#86efac' 
  },
  { 
    id: 'lightpurple', 
    order: 13, 
    notesWithOctave: 'B♭3–D4–F4',
    inversionDescription: 'B♭ major, root position',
    midiNotes: [58, 62, 65], 
    displayIdentity: 'Light Purple', 
    colorHex: '#d8b4fe' 
  },
  { 
    id: 'skyblue', 
    order: 14, 
    notesWithOctave: 'E♭4–G4–B♭4',
    inversionDescription: 'E♭ major, root position',
    midiNotes: [63, 67, 70], 
    displayIdentity: 'Sky Blue', 
    colorHex: '#38bdf8' 
  },
];

export const CHORDS_MAP = new Map(CHORDS.map(c => [c.id, c]));
