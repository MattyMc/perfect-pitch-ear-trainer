import { describe, expect, it } from 'vitest';
import type { Session, Trial } from '../db';
import { groupByDay, summariseSession } from './sessionSummary';

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    profileId: 'p1',
    startedAt: new Date(2026, 9, 15, 9, 0).getTime(),
    lastActivityAt: new Date(2026, 9, 15, 9, 4).getTime(),
    endedAt: new Date(2026, 9, 15, 9, 4).getTime(),
    status: 'completed',
    endReason: 'target_reached',
    scoredTrialCount: 4,
    plannedTrialCount: 4,
    sequence: ['yellow', 'red', 'red', 'yellow'],
    ...overrides,
  };
}

function trial(sequenceIndex: number, presented: string, chosen: string | null, overrides: Partial<Trial> = {}): Trial {
  return {
    id: `t${sequenceIndex}`,
    profileId: 'p1',
    sessionId: 's1',
    sequenceIndex,
    presentedChordId: presented,
    replayCount: 0,
    firstAnswerChordId: chosen,
    firstAnswerCorrect: presented === chosen,
    completedAtUtc: 0,
    correctionTapCount: 0,
    ...overrides,
  };
}

describe('summariseSession', () => {
  const trials = [
    trial(3, 'yellow', 'red'),
    trial(0, 'yellow', 'yellow', { replayCount: 1 }),
    trial(2, 'red', 'yellow'),
    trial(1, 'red', 'yellow', { replayCount: 2 }),
  ];

  it('orders trials by sequence index and counts first answers', () => {
    const s = summariseSession(session(), trials);
    expect(s.trials.map(t => t.sequenceIndex)).toEqual([0, 1, 2, 3]);
    expect(s.correct).toBe(1);
    expect(s.answered).toBe(4);
    expect(s.replays).toBe(3);
  });

  it('reports the sound at index 0 as the first sound', () => {
    expect(summariseSession(session(), trials).firstSound).toEqual({ chordId: 'yellow', correct: true });
  });

  it('has no first sound when index 0 was never answered', () => {
    expect(summariseSession(session(), trials.filter(t => t.sequenceIndex !== 0)).firstSound).toBeNull();
  });

  it('tallies each chord in curriculum order, whatever order they played in', () => {
    expect(summariseSession(session(), trials).perChord).toEqual([
      { chordId: 'red', correct: 0, total: 2 },
      { chordId: 'yellow', correct: 1, total: 2 },
    ]);
  });

  it('groups mix-ups by what played and what was chosen, most frequent first', () => {
    expect(summariseSession(session(), trials).mixUps).toEqual([
      { presentedChordId: 'red', chosenChordId: 'yellow', count: 2 },
      { presentedChordId: 'yellow', chosenChordId: 'red', count: 1 },
    ]);
  });

  it('reads the chord set from the sequence in curriculum order, not from which chords were answered', () => {
    const s = summariseSession(session({ sequence: ['blue', 'red', 'yellow', 'red'] }), [trial(0, 'red', 'red')]);
    expect(s.chordIds).toEqual(['red', 'yellow', 'blue']);
    expect(s.perChord).toEqual([{ chordId: 'red', correct: 1, total: 1 }]);
  });

  it('treats a session with no sequence as an unscored intro', () => {
    const s = summariseSession(session({ sequence: [], plannedTrialCount: 3 }), []);
    expect(s.isIntro).toBe(true);
    expect(s.firstSound).toBeNull();
  });
});

describe('groupByDay', () => {
  it('groups newest-first sessions by local day, keeping their order', () => {
    const at = (day: number, hour: number) =>
      summariseSession(session({ id: `${day}-${hour}`, startedAt: new Date(2026, 9, day, hour).getTime() }), []);
    const days = groupByDay([at(15, 18), at(15, 7), at(14, 23), at(12, 9)]);
    expect(days.map(d => d.summaries.map(s => s.session.id))).toEqual([['15-18', '15-7'], ['14-23'], ['12-9']]);
    expect(days[0].dayStart).toBe(new Date(2026, 9, 15).getTime());
  });
});
