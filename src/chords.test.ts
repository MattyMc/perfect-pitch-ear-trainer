import { describe, expect, it } from 'vitest';
import { CHORDS, CHORDS_MAP, DARK_LABEL_INK, LIGHT_LABEL_INK, chordLabel, labelInkFor } from './chords';

describe('labelInkFor', () => {
  it('puts dark ink on light cards and white ink on dark ones', () => {
    expect(labelInkFor('#fde047')).toBe(DARK_LABEL_INK); // Yellow
    expect(labelInkFor('#171717')).toBe(LIGHT_LABEL_INK); // Black
    expect(labelInkFor('#78350f')).toBe(LIGHT_LABEL_INK); // Brown
  });

  it('gives every chord a name', () => {
    for (const chord of CHORDS) expect(chord.chordName).not.toBe('');
  });
});

describe('chordLabel', () => {
  const yellow = CHORDS_MAP.get('yellow');
  if (!yellow) throw new Error('no yellow chord');

  it('is null when labels are off', () => {
    expect(chordLabel(yellow, 'off')).toBeNull();
  });

  it('drops the bass note for the basic name and keeps it for the full name', () => {
    expect(chordLabel(yellow, 'basic')).toBe('F');
    expect(chordLabel(yellow, 'full')).toBe('F/C');
  });
});
