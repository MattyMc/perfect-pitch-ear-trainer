import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import PlaybackTimingSettings from './PlaybackTimingSettings';

afterEach(cleanup);

function renderSettings(config: { chordDurationMs?: number; inputLockMs?: number }) {
  const onChange = vi.fn();
  const view = render(<PlaybackTimingSettings config={config} onChange={onChange} />);
  const durationGroup = within(view.getByRole('group', { name: 'Chord length' }));
  const lockGroup = within(view.getByRole('group', { name: 'Lock the cards for' }));
  const pressed = (group: typeof durationGroup) =>
    group.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent);
  return { ...view, onChange, durationGroup, lockGroup, pressed };
}

describe('PlaybackTimingSettings', () => {
  it('shows the defaults for a config that has never set them: 1.5 s, locked for the whole chord', () => {
    const { durationGroup, lockGroup, pressed } = renderSettings({});
    expect(pressed(durationGroup)).toEqual(['1.5 s']);
    expect(pressed(lockGroup)).toEqual(['Whole chord']);
  });

  it('shows a stored duration and a shorter lock', () => {
    const { durationGroup, lockGroup, pressed } = renderSettings({ chordDurationMs: 3000, inputLockMs: 500 });
    expect(pressed(durationGroup)).toEqual(['3 s']);
    expect(pressed(lockGroup)).toEqual(['0.5 s']);
  });

  it('saves a new chord length', () => {
    const { durationGroup, onChange } = renderSettings({});
    fireEvent.click(durationGroup.getByRole('button', { name: '3 s' }));
    expect(onChange).toHaveBeenCalledWith({ chordDurationMs: 3000 });
  });

  it('shortening the chord below the saved lock clears the lock, so it cannot reappear later', () => {
    const { durationGroup, onChange } = renderSettings({ chordDurationMs: 3000, inputLockMs: 2000 });
    fireEvent.click(durationGroup.getByRole('button', { name: '1.5 s' }));
    // toStrictEqual, because a plain match treats a missing key as equal to `undefined`.
    expect(onChange.mock.calls[0][0]).toStrictEqual({ chordDurationMs: 1500, inputLockMs: undefined });
  });

  it('changing the chord keeps a saved lock that is still shorter than it', () => {
    const { durationGroup, onChange } = renderSettings({ chordDurationMs: 3000, inputLockMs: 2000 });
    fireEvent.click(durationGroup.getByRole('button', { name: '4 s' }));
    expect(onChange.mock.calls[0][0]).toStrictEqual({ chordDurationMs: 4000 });
  });

  it('saves a lock shorter than the chord', () => {
    const { lockGroup, onChange } = renderSettings({ chordDurationMs: 3000 });
    fireEvent.click(lockGroup.getByRole('button', { name: '0.5 s' }));
    expect(onChange).toHaveBeenCalledWith({ inputLockMs: 500 });
  });

  it('"Whole chord" clears the lock so it follows the chord length', () => {
    const { lockGroup, onChange } = renderSettings({ chordDurationMs: 3000, inputLockMs: 500 });
    fireEvent.click(lockGroup.getByRole('button', { name: 'Whole chord' }));
    expect(onChange).toHaveBeenCalledWith({ inputLockMs: undefined });
  });

  it('disables locks that are not shorter than the chord, since they would mean the whole chord', () => {
    const { lockGroup } = renderSettings({ chordDurationMs: 2000 });
    expect((lockGroup.getByRole('button', { name: '1 s' }) as HTMLButtonElement).disabled).toBe(false);
    expect((lockGroup.getByRole('button', { name: '2 s' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows "Whole chord" when a stored lock no longer fits a shortened chord', () => {
    const { lockGroup, pressed } = renderSettings({ chordDurationMs: 1500, inputLockMs: 2000 });
    expect(pressed(lockGroup)).toEqual(['Whole chord']);
  });

  it('explains why a lock helps and what a tap during the chord does', () => {
    const { getByText } = renderSettings({});
    expect(getByText(/accidental/i)).toBeTruthy();
    expect(getByText(/stops the chord/i)).toBeTruthy();
  });
});
