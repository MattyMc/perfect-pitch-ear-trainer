import { useEffect, useState } from 'react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronDown, History, Sparkles, X } from 'lucide-react';
import { db, Profile, Session, Trial, checkAndCloseStaleSessions } from '../db';
import { CHORDS, CHORDS_MAP } from '../chords';
import { groupByDay, summariseSession, tallyByChord, type ChordTally, type SessionSummary } from '../utils/sessionSummary';

const PAGE_SIZE = 40;
/** How many recent scored sessions the first-sound strip covers. */
const FIRST_SOUND_WINDOW = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SessionHistoryProps {
  profile: Profile;
  onBack: () => void;
}

/** A profile's sessions started in [from, to), newest first, skipping discarded ones. */
function sessionsBetween(profileId: string, from: number | typeof Dexie.minKey, to: number | typeof Dexie.maxKey) {
  return db.sessions
    .where('[profileId+startedAt]')
    .between([profileId, from], [profileId, to])
    .reverse()
    .filter(s => s.status !== 'discarded');
}

/**
 * A profile's sessions, newest first (skipping discarded ones), each with its trials. A page
 * is at least `limit` sessions and always ends on a whole day, so the oldest day's "N of 4"
 * count is never cut in half by the page boundary.
 */
async function loadSummaries(profileId: string, limit: number) {
  return db.transaction('r', db.sessions, db.trials, async () => {
    let page = await sessionsBetween(profileId, Dexie.minKey, Dexie.maxKey).limit(limit + 1).toArray();
    let hasMore = false;
    if (page.length > limit) {
      const oldestDay = new Date(page[limit - 1].startedAt);
      oldestDay.setHours(0, 0, 0, 0);
      const dayStart = oldestDay.getTime();
      page = await sessionsBetween(profileId, dayStart, Dexie.maxKey).toArray();
      hasMore = (await sessionsBetween(profileId, Dexie.minKey, dayStart).first()) !== undefined;
    }

    const trials = await db.trials.where('sessionId').anyOf(page.map(s => s.id)).toArray();
    const trialsBySession = new Map<string, Trial[]>();
    for (const t of trials) {
      const bucket = trialsBySession.get(t.sessionId);
      if (bucket) bucket.push(t);
      else trialsBySession.set(t.sessionId, [t]);
    }
    return {
      summaries: page.map(s => summariseSession(s, trialsBySession.get(s.id) ?? [])),
      hasMore,
    };
  });
}

export default function SessionHistory({ profile, onBack }: SessionHistoryProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const data = useLiveQuery(() => loadSummaries(profile.id, limit), [profile.id, limit]);

  // Only Practice closed abandoned sessions before, so one left an hour ago still read "In
  // progress" here. The live query re-runs on its own once the sweep writes. A failed sweep
  // just leaves the old statuses showing.
  useEffect(() => {
    checkAndCloseStaleSessions().catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-y-auto select-none">
      <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm border-b border-slate-200 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          onClick={onBack}
          className="justify-self-start flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-slate-700 font-semibold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <div className="font-bold text-slate-800 text-base flex items-center space-x-1.5 min-w-0">
          <History className="w-5 h-5 text-blue-600 shrink-0" />
          <span className="truncate">{profile.name}'s Sessions</span>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-16">
        {data === undefined ? null : data.summaries.length === 0 ? (
          <EmptyState name={profile.name} />
        ) : (
          <>
            <FirstSoundCard summaries={data.summaries} />
            <StripKey />
            {groupByDay(data.summaries).map(day => (
              <section key={day.dayStart} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-bold text-slate-800">{dayLabel(day.dayStart)}</h2>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {completedCount(day.summaries)} of 4 sessions
                  </span>
                </div>
                {day.summaries.map(s => (
                  <SessionCard
                    key={s.session.id}
                    summary={s}
                    expanded={expandedId === s.session.id}
                    onToggle={() => setExpandedId(id => (id === s.session.id ? null : s.session.id))}
                  />
                ))}
              </section>
            ))}
            {data.hasMore && (
              <button
                onClick={() => setLimit(l => Math.max(l, data.summaries.length) + PAGE_SIZE)}
                className="w-full py-3 bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-200 transition-colors"
              >
                Show older sessions
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ name }: { name: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/80 text-center space-y-2">
      <History className="w-8 h-8 text-slate-300 mx-auto" />
      <h2 className="text-base font-bold text-slate-800">No sessions yet</h2>
      <p className="text-xs text-slate-500 leading-relaxed">
        Each time {name} practises, the session appears here with every sound they heard and what they chose.
      </p>
    </div>
  );
}

/**
 * The first sound of a session is the only one heard with no earlier chord to compare it to,
 * so it is the closest thing in a session to recognising the chord from memory alone.
 */
function FirstSoundCard({ summaries }: { summaries: SessionSummary[] }) {
  const [showByChord, setShowByChord] = useState(false);
  const recent = summaries
    .flatMap(s => (s.firstSound ? [{ id: s.session.id, chordCount: s.chordIds.length, ...s.firstSound }] : []))
    .slice(0, FIRST_SOUND_WINDOW);
  if (recent.length === 0) return null;
  const correct = recent.filter(s => s.correct).length;
  // What guessing would score: one in N for a session with N chords.
  const chance = recent.reduce((sum, s) => sum + 1 / Math.max(1, s.chordCount), 0);
  // Oldest on the left, so the strip reads forward in time like the session strips.
  const chronological = [...recent].reverse();
  const byChord = tallyByChord(recent);

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-base font-bold text-slate-800">First sound of each session</h2>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          The first chord has nothing before it to compare with, so it shows what is remembered rather than worked out.
        </p>
      </div>
      <div className="flex items-baseline space-x-2">
        <strong className="text-3xl font-extrabold text-slate-900 tabular-nums">{correct}</strong>
        <span className="text-sm font-semibold text-slate-500">
          of the last {recent.length} {recent.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      <div className="flex gap-[3px]" role="img" aria-label={`First sound correct in ${correct} of ${recent.length} sessions`}>
        {chronological.map(s => (
          <TrialChip key={s.id} chordId={s.chordId} correct={s.correct} size="flex-1 min-w-0 max-w-6 h-6" />
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        Guessing would get about {Math.round(chance)} of {recent.length}.
      </p>
      {/* Collapsed by default: the headline and strip are the summary, this is the detail. */}
      <div className="pt-1 border-t border-slate-100">
        <button
          onClick={() => setShowByChord(v => !v)}
          aria-expanded={showByChord}
          className="w-full flex items-center justify-between pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 active:text-slate-700"
        >
          <span>By first chord</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showByChord ? 'rotate-180' : ''}`} />
        </button>
        {showByChord && (
          <div className="pt-1.5">
            <ChordTallyRows tallies={byChord} />
          </div>
        )}
      </div>
    </section>
  );
}

function StripKey() {
  return (
    <div className="flex items-center justify-center space-x-4 text-[11px] text-slate-500 font-medium">
      <span className="flex items-center space-x-1.5">
        <span className="w-3 h-3 rounded-[3px] bg-slate-500" />
        <span>First answer correct</span>
      </span>
      <span className="flex items-center space-x-1.5">
        <span className="w-3 h-3 rounded-[3px] border-2 border-slate-500 bg-white" />
        <span>Missed</span>
      </span>
      <span className="flex items-center space-x-1.5">
        <span className="w-3 h-3 rounded-[3px] border border-dashed border-slate-300" />
        <span>Not reached</span>
      </span>
    </div>
  );
}

/**
 * One sound, in the colour of the chord that played: solid when the first answer was correct,
 * hollow with a cross when it was missed, so a miss never depends on colour alone. `size`
 * defaults to a cell of the session strip.
 */
function TrialChip({ chordId, correct, size = 'flex-1 min-w-0 max-w-6 h-4' }: { chordId: string; correct: boolean; size?: string }) {
  const chord = CHORDS_MAP.get(chordId);
  const colour = chord?.colorHex ?? '#94a3b8';
  const label = `${chord?.displayIdentity ?? chordId}: ${correct ? 'correct' : 'missed'}`;
  return correct ? (
    <span
      title={label}
      className={`${size} shrink-0 rounded-[3px] ring-1 ring-inset ring-black/10`}
      style={{ backgroundColor: colour }}
    />
  ) : (
    <span
      title={label}
      className={`${size} shrink-0 rounded-[3px] border-2 bg-white flex items-center justify-center`}
      style={{ borderColor: colour }}
    >
      <X className="w-2.5 h-2.5 text-slate-600 shrink-0" strokeWidth={3} />
    </span>
  );
}

function SessionCard({ summary, expanded, onToggle }: { summary: SessionSummary; expanded: boolean; onToggle: () => void }) {
  const { session } = summary;

  if (summary.isIntro) {
    return (
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="w-8 h-8 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: CHORDS[0].colorHex }} />
          <div>
            <div className="text-sm font-bold text-slate-800">Introduction to {CHORDS[0].displayIdentity}</div>
            <div className="text-[11px] text-slate-500">{timeLabel(session.startedAt)} · heard 3 times · unscored</div>
          </div>
        </div>
        <StatusPill summary={summary} />
      </div>
    );
  }

  const notReached = Math.max(0, session.plannedTrialCount - summary.answered);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      <button onClick={onToggle} aria-expanded={expanded} className="w-full text-left px-4 pt-3 pb-3.5 space-y-2.5 active:bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-800">{timeLabel(session.startedAt)}</span>
              <StatusPill summary={summary} />
            </div>
            <ChordSet chordIds={summary.chordIds} />
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <HeadlineStats summary={summary} />
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className="flex gap-[2px]" role="img" aria-label={`${summary.correct} of ${summary.answered} correct${notReached ? `, ${notReached} not reached` : ''}`}>
          {summary.trials.map(t => (
            <TrialChip key={t.id} chordId={t.presentedChordId} correct={t.firstAnswerCorrect} />
          ))}
          {Array.from({ length: notReached }, (_, i) => (
            <span key={`empty-${i}`} className="flex-1 min-w-0 max-w-6 h-4 rounded-[3px] border border-dashed border-slate-300" />
          ))}
        </div>
      </button>

      {expanded && <SessionDetail summary={summary} />}
    </div>
  );
}

/**
 * The chords the session was working on. Active chords are always a prefix of the curriculum,
 * so the newest one pins down the whole set; it is named because it is the one being learnt.
 */
function ChordSet({ chordIds }: { chordIds: string[] }) {
  const newest = CHORDS_MAP.get(chordIds[chordIds.length - 1]);
  const names = chordIds.map(id => CHORDS_MAP.get(id)?.displayIdentity ?? id).join(', ');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
      <span className="flex -space-x-1 shrink-0" role="img" aria-label={`Chords: ${names}`} title={names}>
        {chordIds.map(id => (
          <span
            key={id}
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white"
            style={{ backgroundColor: CHORDS_MAP.get(id)?.colorHex }}
          />
        ))}
      </span>
      <span className="whitespace-nowrap">
        <span className="font-semibold text-slate-700">{chordIds.length} chords</span>
        {newest && <> · newest <span className="font-semibold text-slate-700">{newest.displayIdentity}</span></>}
      </span>
    </div>
  );
}

/**
 * A session's two headline numbers side by side: the first sound (its chip, as in the strip,
 * then a dot in the practice screen's correct/missed colours) and the score, shown as "16 / 20" as the
 * end-of-session screen shows it, with the percentage beneath.
 */
function HeadlineStats({ summary }: { summary: SessionSummary }) {
  const { firstSound } = summary;
  const firstChord = firstSound ? CHORDS_MAP.get(firstSound.chordId) : undefined;
  const percent = summary.answered > 0 ? Math.round((summary.correct / summary.answered) * 100) : 0;
  return (
    <div className="flex items-stretch">
      {/* role="img" so the label is announced (a bare div's aria-label is ignored) and the
          chip inside, whose name is only a title, is not read separately. */}
      <div
        className="flex flex-col items-center pr-3"
        role="img"
        aria-label={firstSound ? `First sound ${firstChord?.displayIdentity}, ${firstSound.correct ? 'correct' : 'missed'}` : 'First sound not answered'}
      >
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">First</span>
        {firstSound ? (
          <span className="flex items-center gap-1.5 h-7">
            <TrialChip chordId={firstSound.chordId} correct={firstSound.correct} size="w-5 h-7" />
            {/* The same dot, in the same colours, as the progress strip under the practice cards. */}
            <span className={`w-2.5 h-2.5 rounded-full ${firstSound.correct ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          </span>
        ) : (
          <span className="h-7 flex items-center text-lg font-bold text-slate-300">–</span>
        )}
        <span className="text-[10px] font-semibold text-slate-500 leading-tight">
          {firstSound ? (firstSound.correct ? 'correct' : 'missed') : 'n/a'}
        </span>
      </div>
      <div className="flex flex-col items-end pl-3 border-l border-slate-200" role="img" aria-label={`Score ${summary.correct} of ${summary.answered} correct, ${percent}%`}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</span>
        <span className="h-7 flex items-center text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
          {summary.correct}<span className="text-base font-bold text-slate-400 ml-0.5">/ {summary.answered}</span>
        </span>
        <span className="text-[10px] font-semibold text-slate-500 leading-tight tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

function SessionDetail({ summary }: { summary: SessionSummary }) {
  // A correction left unfinished only means the session ended there if it was the last sound
  // answered and the session is over; a resumed session moves on past it, keeping the flag.
  const lastTrial = summary.trials[summary.trials.length - 1];
  const endedMidCorrection = summary.session.status !== 'active' && lastTrial?.correctionIncomplete === true;
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 space-y-4">
      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">By chord</h3>
        <ChordTallyRows tallies={summary.perChord} />
      </div>

      <div className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mix-ups</h3>
        {summary.mixUps.length === 0 ? (
          <p className="text-xs text-slate-500">None. Every first answer was correct.</p>
        ) : (
          <ul className="space-y-1.5">
            {summary.mixUps.map(m => (
              <li key={`${m.presentedChordId}>${m.chosenChordId}`} className="flex items-center text-xs text-slate-700">
                <ChordDot chordId={m.presentedChordId} />
                <span className="font-semibold ml-1.5">{CHORDS_MAP.get(m.presentedChordId)?.displayIdentity}</span>
                <span className="mx-1.5 text-slate-400">played, chose</span>
                <ChordDot chordId={m.chosenChordId} />
                <span className="font-semibold ml-1.5">{CHORDS_MAP.get(m.chosenChordId)?.displayIdentity}</span>
                <span className="ml-auto pl-2 font-bold text-slate-500 tabular-nums">×{m.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        {summary.replays === 0
          ? 'The Replay button was not used.'
          : `The Replay button was pressed ${summary.replays === 1 ? 'once' : `${summary.replays} times`} to hear a chord again.`}
      </p>
      {endedMidCorrection && (
        <p className="text-[11px] text-slate-500">
          The session ended during a correction, before the correct card was tapped.
        </p>
      )}
    </div>
  );
}

/** First-answer accuracy per chord: dot and name, a bar in the chord's colour, then "4 / 6". */
function ChordTallyRows({ tallies }: { tallies: ChordTally[] }) {
  return (
    <div className="space-y-1.5">
      {tallies.map(c => {
        const chord = CHORDS_MAP.get(c.chordId);
        return (
          <div key={c.chordId} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-xs">
            <span className="flex items-center space-x-1.5 min-w-0">
              <ChordDot chordId={c.chordId} />
              <span className="font-semibold text-slate-800 truncate">{chord?.displayIdentity ?? c.chordId}</span>
            </span>
            <span className="h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
              <span
                className="block h-full rounded-full ring-1 ring-inset ring-black/10"
                style={{ width: `${(c.correct / c.total) * 100}%`, backgroundColor: chord?.colorHex }}
              />
            </span>
            <span className="text-right font-bold text-slate-700 tabular-nums">{c.correct} / {c.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChordDot({ chordId }: { chordId: string }) {
  return (
    <span
      className="w-3.5 h-3.5 rounded-full ring-1 ring-inset ring-black/15 shrink-0 inline-block"
      style={{ backgroundColor: CHORDS_MAP.get(chordId)?.colorHex }}
    />
  );
}

const STATUS_STYLES: Record<Session['status'], { text: string; className: string }> = {
  completed: { text: 'Completed', className: 'bg-slate-100 text-slate-600' },
  completed_short: { text: 'Ended early', className: 'bg-slate-100 text-slate-600' },
  interrupted: { text: 'Interrupted', className: 'bg-amber-50 text-amber-800' },
  active: { text: 'In progress', className: 'bg-blue-50 text-blue-700' },
  discarded: { text: 'Discarded', className: 'bg-slate-100 text-slate-500' },
};

function StatusPill({ summary }: { summary: SessionSummary }) {
  if (summary.isIntro) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
        <Sparkles className="w-3 h-3 mr-1" />Intro
      </span>
    );
  }
  const { text, className } = STATUS_STYLES[summary.session.status];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${className}`}>{text}</span>;
}

/** Sessions that count toward the day's four, matching the dashboard's "Sessions Today". */
function completedCount(summaries: SessionSummary[]) {
  return summaries.filter(s => s.session.status === 'completed' || s.session.status === 'completed_short').length;
}

function dayLabel(dayStart: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today.getTime() - dayStart) / DAY_MS);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  const date = new Date(dayStart);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  });
}

function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
