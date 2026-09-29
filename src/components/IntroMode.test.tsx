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
    speak: vi.fn(async () => {}),
  };
  return { AudioNeedsGestureError, audio };
});

vi.mock('../audio', () => ({ audio: mocks.audio, AudioNeedsGestureError: mocks.AudioNeedsGestureError }));
vi.mock('../db', () => ({ db: { sessions: { add: vi.fn(async () => {}) } } }));

import IntroMode from './IntroMode';
import { CHORDS_MAP } from '../chords';

const RED_NOTES = CHORDS_MAP.get('red')?.midiNotes;
const INSTRUCTION = 'Listen to the sound, then tap the card.';
/** The mount delay, then the pause after the spoken instruction, before the first chord. */
const FIRST_CHORD_DELAY_MS = 300 + 400;

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const renderIntro = () => render(<IntroMode profileId="p1" chordId="red" chordDurationMs={3000} onExit={() => {}} />);

/** Renders the intro with sound that needs a tap, and waits for the Continue screen. */
async function renderNeedingTap() {
  mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
  const view = renderIntro();
  await advance(FIRST_CHORD_DELAY_MS);
  return view;
}

describe('IntroMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('gives the spoken instruction, then plays the chord for the configured length', async () => {
    renderIntro();
    await advance(FIRST_CHORD_DELAY_MS);

    expect(mocks.audio.speak).toHaveBeenCalledWith(INSTRUCTION);
    expect(mocks.audio.playChord).toHaveBeenCalledWith(RED_NOTES, 3000);
  });

  it('asks for a tap instead of playing into silence when the audio needs a gesture', async () => {
    const { getByText } = await renderNeedingTap();
    expect(mocks.audio.playChord).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(getByText('Continue')); });
    await advance(400);
    expect(mocks.audio.playChord).toHaveBeenCalledWith(RED_NOTES, 3000);
  });

  it('Continue reruns the first step from the spoken instruction', async () => {
    const { getByText } = await renderNeedingTap();
    mocks.audio.speak.mockClear();

    await act(async () => { fireEvent.click(getByText('Continue')); });
    expect(mocks.audio.speak).toHaveBeenCalledWith(INSTRUCTION);
  });

  it('the Continue screen still offers hold-to-exit', async () => {
    const { getByRole, getByText } = await renderNeedingTap();

    expect(getByText('Continue')).toBeTruthy();
    expect(getByRole('button', { name: 'Hold to exit' })).toBeTruthy();
  });
});
