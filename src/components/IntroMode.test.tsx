import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  AudioNeedsGestureError: class AudioNeedsGestureError extends Error {},
  audio: {
    init: vi.fn(async () => {}),
    playChord: vi.fn(),
    stopChord: vi.fn(),
    playSuccessTone: vi.fn(() => 450),
    speak: vi.fn(async () => {}),
  },
}));

vi.mock('../audio', () => ({ audio: mocks.audio, AudioNeedsGestureError: mocks.AudioNeedsGestureError }));
vi.mock('../db', () => ({ db: { sessions: { add: vi.fn(async () => {}) } } }));

import IntroMode from './IntroMode';
import { CHORDS_MAP } from '../chords';

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('IntroMode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('plays the chord for the configured length', async () => {
    render(<IntroMode profileId="p1" chordId="red" chordDurationMs={3000} onExit={() => {}} />);
    await advance(300 + 400); // mount delay, then the pause after the spoken prompt

    expect(mocks.audio.playChord).toHaveBeenCalledWith(CHORDS_MAP.get('red')!.midiNotes, 3000);
  });

  it('asks for a tap instead of playing into silence when the audio needs a gesture', async () => {
    mocks.audio.init.mockRejectedValueOnce(new mocks.AudioNeedsGestureError());
    const { getByText } = render(<IntroMode profileId="p1" chordId="red" chordDurationMs={3000} onExit={() => {}} />);
    await advance(300);

    expect(mocks.audio.playChord).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(getByText('Continue')); });

    expect(mocks.audio.playChord).toHaveBeenCalledWith(CHORDS_MAP.get('red')!.midiNotes, 3000);
  });
});
