import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import ParentGate from './ParentGate';
import HoldToExit from './HoldToExit';

// A hidden browser tab runs no animation frames at all. Both hold controls must still
// complete, because only the progress fill is drawn by frames.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('ParentGate', () => {
  const renderGate = () => {
    const view = render(<ParentGate onCancel={() => {}}><p>Parent area</p></ParentGate>);
    const holdButton = () => view.getByText('Hold').closest('button')!;
    return { ...view, holdButton };
  };

  it('unlocks after a one-second hold even when no animation frames run', async () => {
    const { holdButton, queryByText } = renderGate();
    fireEvent.pointerDown(holdButton());

    await advance(999);
    expect(queryByText('Parent area')).toBeNull();

    await advance(1);
    expect(queryByText('Parent area')).not.toBeNull();
  });

  it('stays locked when the hold is released early', async () => {
    const { holdButton, queryByText } = renderGate();
    fireEvent.pointerDown(holdButton());
    await advance(500);
    fireEvent.pointerUp(holdButton());

    await advance(2000);
    expect(queryByText('Parent area')).toBeNull();
  });

  it('stays locked when the pointer slides off the button', async () => {
    const { holdButton, queryByText } = renderGate();
    fireEvent.pointerDown(holdButton());
    await advance(500);
    fireEvent.pointerLeave(holdButton());

    await advance(2000);
    expect(queryByText('Parent area')).toBeNull();
  });
});

describe('HoldToExit', () => {
  it('exits after a one-second hold even when no animation frames run', async () => {
    const onExit = vi.fn();
    const { container } = render(<HoldToExit onExit={onExit} />);
    fireEvent.pointerDown(container.querySelector('button')!);

    await advance(999);
    expect(onExit).not.toHaveBeenCalled();

    await advance(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('does not exit when released early', async () => {
    const onExit = vi.fn();
    const { container } = render(<HoldToExit onExit={onExit} />);
    const button = container.querySelector('button')!;
    fireEvent.pointerDown(button);
    await advance(500);
    fireEvent.pointerUp(button);

    await advance(2000);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('does not exit after unmounting mid-hold', async () => {
    const onExit = vi.fn();
    const { container, unmount } = render(<HoldToExit onExit={onExit} />);
    fireEvent.pointerDown(container.querySelector('button')!);
    await advance(500);
    unmount();

    await advance(2000);
    expect(onExit).not.toHaveBeenCalled();
  });
});
