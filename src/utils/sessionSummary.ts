import type { Session, Trial } from '../db';
import { CHORDS_MAP } from '../chords';

export interface ChordTally {
  chordId: string;
  correct: number;
  total: number;
}

export interface MixUp {
  presentedChordId: string;
  chosenChordId: string;
  count: number;
}

export interface SessionSummary {
  session: Session;
  /** An IntroMode row: unscored, writes no trials. */
  isIntro: boolean;
  /** Trials in the order they were presented. */
  trials: Trial[];
  correct: number;
  answered: number;
  /**
   * The sound at sequence index 0: the only answer in a session with no earlier chord to
   * compare against. Null when that trial was never answered (or for an intro).
   */
  firstSound: { chordId: string; correct: boolean } | null;
  /**
   * The chords the session was working on, in curriculum order, read from the session's own
   * sequence so an old session shows its own level. The last one is the newest chord.
   */
  chordIds: string[];
  perChord: ChordTally[];
  /** Wrong first answers grouped by what played and what was chosen, most frequent first. */
  mixUps: MixUp[];
  /** Presses of the Replay button, which plays the current chord again. */
  replays: number;
}

const curriculumOrder = (chordId: string) => CHORDS_MAP.get(chordId)?.order ?? Infinity;

/** Summarises one session from its row and its trials (in any order). */
export function summariseSession(session: Session, trials: Trial[]): SessionSummary {
  const ordered = [...trials].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const isIntro = session.sequence.length === 0;

  const chordIds = [...new Set(session.sequence)].sort((a, b) => curriculumOrder(a) - curriculumOrder(b));
  const tallies = new Map(chordIds.map(id => [id, { chordId: id, correct: 0, total: 0 }]));
  const mixUps = new Map<string, MixUp>();
  let correct = 0;
  let replays = 0;

  for (const t of ordered) {
    let tally = tallies.get(t.presentedChordId);
    if (!tally) {
      tally = { chordId: t.presentedChordId, correct: 0, total: 0 };
      tallies.set(t.presentedChordId, tally);
    }
    tally.total += 1;
    replays += t.replayCount;
    if (t.firstAnswerCorrect) {
      correct += 1;
      tally.correct += 1;
    } else if (t.firstAnswerChordId) {
      const key = `${t.presentedChordId}>${t.firstAnswerChordId}`;
      const m = mixUps.get(key) ?? { presentedChordId: t.presentedChordId, chosenChordId: t.firstAnswerChordId, count: 0 };
      m.count += 1;
      mixUps.set(key, m);
    }
  }

  const first = ordered.find(t => t.sequenceIndex === 0);

  return {
    session,
    isIntro,
    trials: ordered,
    correct,
    answered: ordered.length,
    firstSound: first ? { chordId: first.presentedChordId, correct: first.firstAnswerCorrect } : null,
    chordIds,
    // Curriculum order, so the rows sit in the same place from one session to the next.
    perChord: [...tallies.values()]
      .filter(t => t.total > 0)
      .sort((a, b) => curriculumOrder(a.chordId) - curriculumOrder(b.chordId)),
    mixUps: [...mixUps.values()].sort((a, b) => b.count - a.count),
    replays,
  };
}

export interface SessionDay {
  /** Local midnight of the day, as a timestamp. */
  dayStart: number;
  summaries: SessionSummary[];
}

/** Groups summaries (newest first) by the local day they started on, keeping that order. */
export function groupByDay(summaries: SessionSummary[]): SessionDay[] {
  const days: SessionDay[] = [];
  for (const s of summaries) {
    const d = new Date(s.session.startedAt);
    d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const last = days[days.length - 1];
    if (last && last.dayStart === dayStart) last.summaries.push(s);
    else days.push({ dayStart, summaries: [s] });
  }
  return days;
}
