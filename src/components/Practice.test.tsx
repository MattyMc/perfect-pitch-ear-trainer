import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  class AudioNeedsGestureError extends Error {}
  const audio = {
    init: vi.fn(async () => {}),
    playChord: vi.fn(),
    // Mirrors AudioEngine.play: readies the audio through init(), then plays.
    play: vi.fn(async (midiNotes: number[], durationMs: number) => {
      try {
        await audio.init();
      } catch (err) {
        if (err instanceof AudioNeedsGestureError) return 'needs-tap';
        throw err;
      }
      audio.playChord(midiNotes, durationMs);
      return 'played';
    }),
    stopChord: vi.fn(),
    playSuccessTone: vi.fn(() => 450),
    playMissTone: vi.fn(() => 220),
  };
  return { AudioNeedsGestureError, audio, db: {
    db: {
      sessions: { add: vi.fn(async () => {}), update: vi.fn(async () => 1) },
    },
    checkAndCloseStaleSessions: vi.fn(async () => {}),
    getResumeableSession: vi.fn(async () => undefined),
    endSession: vi.fn(async () => {}),
    recordTrial: vi.fn(async () => true),
  } };
});

vi.mock('../audio', () => ({ audio: mocks.audio, AudioNeedsGestureError: mocks.AudioNeedsGestureError }));
vi.mock('../db', () => mocks.db);
// Red is always presented first, so the tests know which card is right.
vi.mock('../utils/scheduler', () => ({
  generateSessionSequence: (_ids: string[], count: number) => Array.from({ length: count }, () => 'red'),
}));

import Practice from './Practice';
import { CHORDS_MAP } from '../chords';
import type { ChordLabelStyle } from '../db';

const RED_NOTES = CHORDS_MAP.get('red')?.midiNotes;
/** Practice waits this long after mounting before the first chord. */
const FIRST_CHORD_DELAY_MS = 400;

function renderPractice(timing: { chordDurationMs: number; inputLockMs: number }, chordLabels: ChordLabelStyle = 'off') {
  const view = render(
    <Practice
      profileId="p1"
      activeChordIds={['red', 'yellow']}
      trialsPerSession={20}
      chordDurationMs={timing.chordDurationMs}
      inputLockMs={timing.inputLockMs}
      chordLabels={chordLabels}
      onExit={() => {}}
    />,
  );
  const card = (id: string) => {
    const button = view.container.querySelector<HTMLButtonElement>(`button[data-chord-id="${id}"]`);
    if (!button) throw new Error(`no card for ${id}`);
    return button;
  };
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

  it('after a wrong tap, plays the soft note, then the chord again, with only the right card live', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    await act(async () => { fireEvent.click(card('yellow')); });

    // A soft note, not the chime, and the right card can be tapped before it is even over.
    expect(mocks.audio.stopChord).toHaveBeenCalledTimes(1);
    expect(mocks.audio.playMissTone).toHaveBeenCalledTimes(1);
    expect(mocks.audio.playSuccessTone).not.toHaveBeenCalled();
    expect(card('red').disabled).toBe(false);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(1);

    // The chord the child cut off starts again once the note has had its moment.
    await advance(220);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(2);
    expect(mocks.audio.playChord).toHaveBeenLastCalledWith(RED_NOTES, 3000);
    // No lock: the right card can be tapped straight away. The others are emptied.
    expect(card('red').disabled).toBe(false);
    expect(card('yellow').disabled).toBe(true);
  });

  it('tapping the right card after a miss moves on without a success sound', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);
    await act(async () => { fireEvent.click(card('yellow')); });
    await advance(220);
    await act(async () => { fireEvent.click(card('red')); });

    expect(mocks.audio.playSuccessTone).not.toHaveBeenCalled();
    // The replay is cut off, and the next chord follows the usual short pause.
    expect(mocks.audio.stopChord).toHaveBeenCalledTimes(2);
    await advance(350);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(3);
  });

  it('a wrong tap is saved once, as a finished trial with the first answer kept', async () => {
    const { card } = renderPractice({ chordDurationMs: 1500, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);
    await act(async () => { fireEvent.click(card('yellow')); });
    await act(async () => { fireEvent.click(card('red')); });
    await advance(350);

    expect(mocks.db.recordTrial).toHaveBeenCalledTimes(1);
    expect(mocks.db.recordTrial).toHaveBeenCalledWith(
      expect.objectContaining({ firstAnswerChordId: 'yellow', firstAnswerCorrect: false, correctionIncomplete: false }),
      expect.objectContaining({ scoredTrialCount: 1 }),
    );
  });

  it('after a miss, Replay plays the chord again without locking the right card', async () => {
    const { card, getByText } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);
    await act(async () => { fireEvent.click(card('yellow')); });
    await advance(220);

    await act(async () => { fireEvent.click(getByText('Replay')); });
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(3);
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

  it('asks for a tap instead of playing into silence when the audio needs a gesture', async () => {
    mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
    const { getByText, queryByText } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS);

    expect(mocks.audio.playChord).not.toHaveBeenCalled();
    expect(queryByText('Audio Error')).toBeNull();
    await act(async () => { fireEvent.click(getByText('Continue')); });

    expect(mocks.audio.playChord).toHaveBeenCalledWith(RED_NOTES, 3000);
  });

  it('the Continue screen still offers hold-to-exit, so a parent is never stuck on it', async () => {
    mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
    const { getByText, getByRole } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS);

    expect(getByText('Continue')).toBeTruthy();
    expect(getByRole('button', { name: 'Hold to exit' })).toBeTruthy();
  });

  it('a right-card tap during the wrong-guess note skips the replay altogether', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);
    await act(async () => { fireEvent.click(card('yellow')); });
    await advance(100);
    await act(async () => { fireEvent.click(card('red')); });

    await advance(120);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(1);
    // Then the next trial's chord, after the usual pause.
    await advance(230);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(2);
  });

  it('a right-card tap that lands while the piano is still loading silences the late replay', async () => {
    const { card } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    // The wrong tap may have just rebuilt the audio, so the piano could still be loading.
    let finishLoading = () => {};
    mocks.audio.init.mockImplementationOnce(() => new Promise<void>(resolve => { finishLoading = resolve; }));
    await act(async () => { fireEvent.click(card('yellow')); });
    await advance(220);
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(card('red')); });
    const stopsBefore = mocks.audio.stopChord.mock.calls.length;
    await act(async () => { finishLoading(); });
    // The replay starts late, after the child has moved on, and is stopped at once.
    expect(mocks.audio.stopChord.mock.calls.length).toBe(stopsBefore + 1);
  });

  it('if the audio needs a tap after a wrong answer, the right card is still live', async () => {
    const { card, queryByText } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
    await act(async () => { fireEvent.click(card('yellow')); });
    await advance(220);

    // Not the Continue screen: the right card and Replay are both taps that bring sound back.
    expect(queryByText('Continue')).toBeNull();
    expect(mocks.audio.playChord).toHaveBeenCalledTimes(1);
    expect(card('red').disabled).toBe(false);
  });

  it('a replay that could not play is not counted', async () => {
    const { card, getByText } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 500);

    mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
    await act(async () => { fireEvent.click(getByText('Replay')); });
    await act(async () => { fireEvent.click(card('red')); });

    expect(mocks.db.recordTrial).toHaveBeenCalledWith(expect.objectContaining({ replayCount: 0 }), expect.anything());
  });

  it('stops the chord when the practice screen unmounts', async () => {
    const { unmount } = renderPractice({ chordDurationMs: 3000, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS + 100);

    unmount();
    expect(mocks.audio.stopChord).toHaveBeenCalled();
  });
});

describe('Practice chord names', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('leaves the cards blank by default', async () => {
    const { card } = renderPractice({ chordDurationMs: 1500, inputLockMs: 500 });
    await advance(FIRST_CHORD_DELAY_MS);
    expect(card('red').textContent).toBe('');
    expect(card('yellow').textContent).toBe('');
  });

  it('prints the basic chord name, without the bass note', async () => {
    const { card } = renderPractice({ chordDurationMs: 1500, inputLockMs: 500 }, 'basic');
    await advance(FIRST_CHORD_DELAY_MS);
    expect(card('red').textContent).toBe('C');
    expect(card('yellow').textContent).toBe('F');
  });

  it('prints the full chord name, with the bass note of an inversion', async () => {
    const { card } = renderPractice({ chordDurationMs: 1500, inputLockMs: 500 }, 'full');
    await advance(FIRST_CHORD_DELAY_MS);
    expect(card('red').textContent).toBe('C');
    expect(card('yellow').textContent).toBe('F/C');
  });
});
