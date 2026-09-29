import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  audio: {
    init: vi.fn(async () => {}),
    playChord: vi.fn(),
    stopChord: vi.fn(),
    playSuccessTone: vi.fn(() => 450),
    speak: vi.fn(async () => {}),
  },
  db: {
    db: {
      sessions: { add: vi.fn(async () => {}), update: vi.fn(async () => 1) },
    },
    checkAndCloseStaleSessions: vi.fn(async () => {}),
    getResumeableSession: vi.fn(async () => undefined),
    endSession: vi.fn(async () => {}),
    recordTrial: vi.fn(async () => true),
  },
}));

vi.mock('../audio', () => ({ audio: mocks.audio }));
vi.mock('../db', () => mocks.db);
// Red is always presented first, so the tests know which card is right.
vi.mock('../utils/scheduler', () => ({
  generateSessionSequence: (_ids: string[], count: number) => Array.from({ length: count }, () => 'red'),
}));

import Practice from './Practice';
import { CHORDS_MAP } from '../chords';

const RED_NOTES = CHORDS_MAP.get('red')!.midiNotes;
/** Practice waits this long after mounting before the first chord. */
const FIRST_CHORD_DELAY_MS = 400;

function renderPractice(timing: { chordDurationMs: number; inputLockMs: number }) {
  const view = render(
    <Practice
      profileId="p1"
      activeChordIds={['red', 'yellow']}
      trialsPerSession={20}
      chordDurationMs={timing.chordDurationMs}
      inputLockMs={timing.inputLockMs}
      onExit={() => {}}
    />,
  );
  const card = (id: string) => view.container.querySelector<HTMLButtonElement>(`button[data-chord-id="${id}"]`)!;
  return { ...view, card };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('Practice playback timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays the chord for the configured duration', async () => {
    renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS);

    expect(mocks.audio.playChord).toHaveBeenCalledWith(RED_NOTES, 3000);
  });

  it('keeps the cards disabled for the lock, then enables them while the chord still sounds', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS);

    await advance(499);
    expect(card('red').disabled).toBe(true);
    expect(card('yellow').disabled).toBe(true);

    await advance(1);
    expect(card('red').disabled).toBe(false);
    expect(card('yellow').disabled).toBe(false);
    // Unlocking must not cut the chord off — only a tap does.
    expect(mocks.audio.stopChord).not.toHaveBeenCalled();
  });

  it('with the lock equal to the chord, keeps the cards disabled for the whole chord', async () => {
    const { card } = renderPractice({ chordDurationMs: 2000, inputLockMs: 2000 });
    await advance(FIRST_CHORD_DELAY_MS);

    await advance(1999);
    expect(card('red').disabled).toBe(true);

    await advance(1);
    expect(card('red').disabled).toBe(false);
  });

  it('a correct tap during the chord interrupts it before the success chime', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    await act(async () => { fireEvent.click(card('red')); });

    expect(mocks.audio.stopChord).toHaveBeenCalledTimes(1);
    expect(mocks.audio.playSuccessTone).toHaveBeenCalledTimes(1);
    expect(mocks.audio.stopChord.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.audio.playSuccessTone.mock.invocationCallOrder[0]);
  });

  it('a wrong tap during the chord interrupts it before the spoken correction', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    await act(async () => { fireEvent.click(card('yellow')); });

    expect(mocks.audio.stopChord).toHaveBeenCalledTimes(1);
    expect(mocks.audio.speak).toHaveBeenCalledWith('That was Red');
    expect(mocks.audio.stopChord.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.audio.speak.mock.invocationCallOrder[0]);
  });

  it('the correction replay uses the same duration and lock', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);
    await act(async () => { fireEvent.click(card('yellow')); });

    // Spoken correction resolves immediately (mocked); then a 300 ms pause before the replay.
    await advance(300);
    expect(mocks.audio.playChord).toHaveBeenLastCalledWith(RED_NOTES, 3000);
    expect(card('red').disabled).toBe(true);

    await advance(500);
    expect(card('red').disabled).toBe(false);
  });

  it('Replay plays the configured duration and relocks for the configured lock', async () => {
    const { card, getByText } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    await act(async () => { fireEvent.click(getByText('Replay')); });
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(2);
    expect(mocks.audio.playChord).toHaveBeenLastCalledWith(RED_NOTES, 3000);
    expect(card('red').disabled).toBe(true);

    await advance(500);
    expect(card('red').disabled).toBe(false);
  });

  it('stops the chord when the practice screen unmounts', async () => {
    const { unmount } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 100);

    unmount();
    expect(mocks.audio.stopChord).toHaveBeenCalled();
  });
});
