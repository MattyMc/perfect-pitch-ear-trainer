import { useState, useEffect, useRef } from 'react';
import { Ear, RotateCw, Check } from 'lucide-react';
import { CHORDS_MAP, chordLabel, labelInkFor } from '../chords';
import { audio, type PlayResult } from '../audio';
import { db, type ChordLabelStyle, checkAndCloseStaleSessions, getResumeableSession, endSession, recordTrial } from '../db';
import { generateSessionSequence } from '../utils/scheduler';
import { newId } from '../utils/id';
import HoldToExit from './HoldToExit';
import PracticeDone from './PracticeDone';
import ResumePrompt from './ResumePrompt';

interface PracticeProps {
  profileId: string;
  activeChordIds: string[];
  trialsPerSession: number;
  /** How long each chord is held. From `resolvePlaybackTiming`. */
  chordDurationMs: number;
  /** How long the cards stay disabled after a chord starts; never longer than the chord. */
  inputLockMs: number;
  /** Whether and how to print each chord's name on its card. A parent setting, off by default. */
  chordLabels: ChordLabelStyle;
  onExit: () => void;
}

type TrialState = 'Initializing' | 'NeedsResumeTap' | 'Ready' | 'Playing' | 'Awaiting' | 'Correct' | 'CorrectionTap' | 'Done';

export default function Practice({ profileId, activeChordIds, trialsPerSession, chordDurationMs, inputLockMs, chordLabels, onExit }: PracticeProps) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trialState, setTrialState] = useState<TrialState>('Initializing');
  
  // Trial tracking
  const [sessionId, setSessionId] = useState<string>('');
  const [replayCount, setReplayCount] = useState(0);
  const [trialResults, setTrialResults] = useState<boolean[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTrialId, setCurrentTrialId] = useState<string>(newId());

  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);
  /**
   * The id of the trial whose miss is waiting for a tap on the right card, or null. The replay
   * after a miss is asynchronous and the card is live throughout, so each replay checks this
   * to learn whether the child has already moved on.
   */
  const correctingTrialRef = useRef<string | null>(null);

  const isScoredSession = activeChordIds.length > 1;

  useEffect(() => {
    isMountedRef.current = true;

    async function initSession() {
      if (isScoredSession) {
        await checkAndCloseStaleSessions();
        const active = await getResumeableSession(profileId);
        if (!isMountedRef.current) return;

        if (active) {
          setSessionId(active.id);
          setSequence(active.sequence);
          
          const sessionTrials = await db.trials.where('sessionId').equals(active.id).sortBy('sequenceIndex');
          const nextIdx = sessionTrials.length;
          
          setCurrentIndex(nextIdx);
          setTrialResults(sessionTrials.map(t => t.firstAnswerCorrect));
          
          if (nextIdx >= trialsPerSession) {
            setTrialState('Done');
          } else {
            setTrialState('NeedsResumeTap');
          }
          return;
        }
      }

      const sid = newId();
      setSessionId(sid);
      const seq = generateSessionSequence(activeChordIds, trialsPerSession);
      setSequence(seq);
      
      if (isScoredSession) {
        await db.sessions.add({
          id: sid,
          profileId,
          startedAt: Date.now(),
          lastActivityAt: Date.now(),
          endedAt: null,
          status: 'active',
          endReason: null,
          scoredTrialCount: 0,
          plannedTrialCount: trialsPerSession,
          sequence: seq,
        });
      }
      
      setTimeout(() => {
        if (isMountedRef.current) {
          startTrial(seq[0], sid);
        }
      }, 400);
    }

    initSession();

    return () => {
      isMountedRef.current = false;
      audio.stopChord();
    };
  }, []);

  const updateActivity = async (sid = sessionId) => {
    if (sid && isScoredSession) {
      await db.sessions.update(sid, { lastActivityAt: Date.now() });
    }
  };

  const handleExit = async () => {
    if (sessionId && isScoredSession && trialState !== 'Done' && trialState !== 'Initializing') {
      await endSession(sessionId, 'parent_ended');
    }
    onExit();
  };

  const currentChordId = sequence[currentIndex];
  const currentChord = currentChordId ? CHORDS_MAP.get(currentChordId) : null;

  /** Plays a chord at the profile's length. Resolves 'failed' after showing the audio error. */
  const playOrReport = async (midiNotes: number[]): Promise<PlayResult | 'failed'> => {
    try {
      return await audio.play(midiNotes, chordDurationMs);
    } catch (err) {
      if (isMountedRef.current) setAudioError(err instanceof Error ? err.message : 'Audio failed to load');
      return 'failed';
    }
  };

  const startTrial = async (chordId: string, sid = sessionId) => {
    if (!isMountedRef.current) return;
    const chord = CHORDS_MAP.get(chordId);
    if (!chord) return;

    setTrialState('Playing');
    isProcessingRef.current = true;
    updateActivity(sid);

    const result = await playOrReport(chord.midiNotes);
    if (!isMountedRef.current) return;
    if (result === 'played') {
      // Hold the cards for the input lock. The chord keeps sounding after the lock ends unless
      // a tap cuts it off.
      await new Promise(r => setTimeout(r, inputLockMs));
      if (!isMountedRef.current) return;
      setTrialState('Awaiting');
    } else if (result === 'needs-tap') {
      // The sound needs a tap to start again (e.g. the app was reopened from the background):
      // show Continue, whose tap rebuilds the audio, rather than playing into silence.
      setTrialState('NeedsResumeTap');
    }
    isProcessingRef.current = false;
  };

  const handleReplay = async () => {
    const chord = currentChordId ? CHORDS_MAP.get(currentChordId) : undefined;
    if ((trialState !== 'Awaiting' && trialState !== 'CorrectionTap') || !chord || !isMountedRef.current || isProcessingRef.current) {
      return;
    }

    updateActivity();
    if (trialState === 'CorrectionTap') {
      // After a miss the right card stays live: no lock, so the child can tap as soon as they
      // like. Not counted: the trial was saved when it was answered.
      await playOrReport(chord.midiNotes);
      if (isMountedRef.current && correctingTrialRef.current !== currentTrialId) audio.stopChord();
      return;
    }

    isProcessingRef.current = true;
    setTrialState('Playing');

    const result = await playOrReport(chord.midiNotes);
    if (!isMountedRef.current) return;
    if (result === 'played') {
      // Counted only when it played, so a replay the child never heard isn't saved.
      setReplayCount(prev => prev + 1);
      await new Promise(r => setTimeout(r, inputLockMs));
      if (!isMountedRef.current) return;
    }
    // Replay is itself a tap, so 'needs-tap' just means "press it again".
    setTrialState('Awaiting');
    isProcessingRef.current = false;
  };

  /**
   * Persists the trial. Resolves false when the session row has gone (the parent reset or
   * deleted this profile from another tab), in which case nothing was written and the caller
   * should leave.
   */
  const saveTrial = async (correct: boolean, firstAns: string): Promise<boolean> => {
    if (!currentChordId) return true;

    setTrialResults(prev => {
      const newResults = [...prev];
      newResults[currentIndex] = correct;
      return newResults;
    });

    const presentedGridIndex = activeChordIds.indexOf(currentChordId);
    const firstAnswerGridIndex = activeChordIds.indexOf(firstAns);

    if (isScoredSession) {
      const now = Date.now();
      const isCompleted = currentIndex + 1 >= trialsPerSession;
      const sessionPatch = {
        scoredTrialCount: currentIndex + 1,
        lastActivityAt: now,
        status: isCompleted ? 'completed' as const : 'active' as const,
        endReason: isCompleted ? 'target_reached' as const : null,
        endedAt: isCompleted ? now : null,
      };

      const written = await recordTrial({
        id: currentTrialId,
        profileId,
        sessionId,
        sequenceIndex: currentIndex,
        presentedChordId: currentChordId,
        presentedGridIndex,
        replayCount,
        firstAnswerChordId: firstAns,
        firstAnswerGridIndex,
        firstAnswerCorrect: correct,
        completedAtUtc: now,
        // The trial is finished the moment it is answered, and only the right card is live
        // after a miss, so there is nothing to count or leave unfinished. Both fields remain
        // for sessions recorded when the correction was a longer, separately saved step.
        correctionTapCount: 0,
        correctionIncomplete: false,
      }, sessionPatch);
      if (!written) {
        onExit();
        return false;
      }
    }
    return true;
  };

  const advanceTrial = async () => {
    if (!isMountedRef.current) return;

    if (currentIndex + 1 >= trialsPerSession) {
      setTrialState('Done');
    } else {
      setTrialState('Ready');
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setReplayCount(0);
      setCurrentTrialId(newId());

      // Brief silent pause before presenting next stimulus
      await new Promise(r => setTimeout(r, 350));
      if (!isMountedRef.current) return;

      updateActivity();
      startTrial(sequence[nextIdx]);
    }
  };

  // Cards are drawn only when they can be tapped; otherwise an empty outline holds the place.
  const isInputLocked = trialState !== 'Awaiting' && trialState !== 'CorrectionTap';

  const handleCardTap = async (tappedChordId: string) => {
    if (!isMountedRef.current || !currentChordId || isInputLocked || isProcessingRef.current) return;

    // A tap during the chord answers it, so the chord stops rather than ringing on.
    audio.stopChord();

    if (trialState === 'CorrectionTap') {
      // Only the right card is live here. No chime: this tap just moves things along.
      if (tappedChordId !== currentChordId) return;
      isProcessingRef.current = true;
      correctingTrialRef.current = null;
      advanceTrial();
      return;
    }

    isProcessingRef.current = true;
    const isCorrect = tappedChordId === currentChordId;
    // The screen answers the tap at once; the write follows.
    setTrialState(isCorrect ? 'Correct' : 'CorrectionTap');
    const missToneMs = isCorrect ? 0 : audio.playMissTone();
    if (isCorrect) audio.playSuccessTone();
    if (!(await saveTrial(isCorrect, tappedChordId))) return;

    if (isCorrect) {
      // Let success chime finish
      await new Promise(r => setTimeout(r, 850));
      if (!isMountedRef.current) return;
      advanceTrial();
      return;
    }

    // A miss: a short, soft note, the other cards empty out, and the right card is live
    // straight away, with no lock, so the child can tap it and move on. The chord plays again
    // once that note has faded to its tail, so the two don't smear together.
    correctingTrialRef.current = currentTrialId;
    isProcessingRef.current = false;
    await new Promise(r => setTimeout(r, missToneMs));
    // The child may already have tapped the right card.
    if (!isMountedRef.current || correctingTrialRef.current !== currentTrialId) return;
    // If the sound needs another tap, the card tap or Replay provides it.
    await playOrReport(CHORDS_MAP.get(currentChordId)!.midiNotes);
    // Or tapped while the piano was getting ready.
    if (isMountedRef.current && correctingTrialRef.current !== currentTrialId) audio.stopChord();
  };

  if (trialState === 'Initializing') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="animate-pulse w-12 h-12 rounded-full bg-blue-200"></div>
      </div>
    );
  }

  if (audioError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 bg-slate-50">
        <h2 className="text-2xl font-bold text-red-600">Audio Error</h2>
        <p className="text-slate-700 text-lg">{audioError}</p>
        <button 
          onClick={onExit}
          className="px-8 py-4 bg-slate-200 text-slate-800 rounded-full font-bold shadow-sm active:scale-95"
        >
          Return to Menu
        </button>
      </div>
    );
  }

  if (trialState === 'NeedsResumeTap') {
    return <ResumePrompt onExit={handleExit} onContinue={() => startTrial(sequence[currentIndex], sessionId)} />;
  }

  if (trialState === 'Done') {
    return (
      <PracticeDone 
        trialResults={trialResults}
        sequence={sequence}
        isScoredSession={isScoredSession}
        onExit={onExit}
      />
    );
  }

  // Calculate grid layout based on active chord count
  const numChords = activeChordIds.length;
  let gridClass = "";
  if (numChords <= 2) gridClass = "grid-cols-1 grid-rows-2 w-full max-w-sm";
  else if (numChords <= 4) gridClass = "grid-cols-2 grid-rows-2 w-full max-w-sm";
  else if (numChords <= 6) gridClass = "grid-cols-2 grid-rows-3 w-full max-w-sm";
  else if (numChords <= 9) gridClass = "grid-cols-3 grid-rows-3 w-full max-w-md";
  else gridClass = "grid-cols-4 grid-rows-4 w-full max-w-lg";

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none touch-manipulation pb-[env(safe-area-inset-bottom)]">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 pt-12 pb-2">
        <HoldToExit onExit={handleExit} />
        <div className="flex-1" />
        <div className="w-12" /> {/* Spacer to balance the top bar */}
      </div>

      {/* Central Ear/Replay Area */}
      <div className="flex items-center justify-center h-24 mb-4">
        {trialState === 'Playing' ? (
           <div className="flex flex-col items-center space-y-1.5">
             <div className="relative flex items-center justify-center">
               <Ear className="w-12 h-12 text-blue-500 animate-pulse relative z-10" />
               <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
             </div>
             <span className="text-xs font-semibold text-blue-600">Listen</span>
           </div>
        ) : (trialState === 'Awaiting' || trialState === 'CorrectionTap') ? (
           <button 
             onClick={handleReplay} 
             className="p-3 px-6 bg-white text-blue-600 rounded-full active:bg-blue-50 hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 shadow-sm border border-blue-100 cursor-pointer"
           >
             <RotateCw className="w-6 h-6" />
             <span className="text-base font-bold">Replay</span>
           </button>
        ) : trialState === 'Correct' ? (
           <div className="flex items-center space-x-2 text-green-600 font-bold text-lg">
             <Check className="w-6 h-6" />
             <span>Great!</span>
           </div>
        ) : null}
      </div>

      {/* Cards Grid */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={`grid ${gridClass} gap-4 w-full h-full max-h-[600px]`}>
          {activeChordIds.map(id => {
            const chord = CHORDS_MAP.get(id)!;
            const isTarget = id === currentChordId;
            const label = chordLabel(chord, chordLabels);
            const isLive = trialState === 'Awaiting' || (trialState === 'CorrectionTap' && isTarget);
            // The card just answered correctly stays out, ringed, while the chime plays.
            const isCelebrated = trialState === 'Correct' && isTarget;

            let cardState: string;
            if (isLive) {
              cardState = 'opacity-100 scale-100 shadow-sm active:scale-95 cursor-pointer';
            } else if (isCelebrated) {
              cardState = 'opacity-100 scale-105 shadow-xl ring-4 ring-green-400 pointer-events-none';
            } else {
              // Emptied, not dimmed: a faded card still looks like something to tap.
              cardState = 'opacity-0 pointer-events-none';
            }

            return (
              <div
                key={id}
                className={`relative rounded-[2rem] border-[3px] border-dashed transition-colors duration-150 ${isLive || isCelebrated ? 'border-transparent' : 'border-slate-300'}`}
                style={{ minHeight: '72px' }}
              >
                <button
                  data-chord-id={id}
                  onClick={() => handleCardTap(id)}
                  disabled={!isLive}
                  className={`absolute -inset-[3px] overflow-hidden rounded-[2rem] transition-all duration-150 motion-reduce:transition-none ${cardState}`}
                  style={{ backgroundColor: chord.colorHex }}
                >
                  {label && (
                     <span
                       className="absolute inset-0 flex items-center justify-center text-3xl font-black tracking-tight"
                       style={{ color: labelInkFor(chord.colorHex) }}
                     >
                       {label}
                     </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtle Progress Indicator at Bottom */}
      <div className="w-full flex flex-wrap justify-center items-center gap-1.5 p-4 opacity-50 pb-8">
        {[...Array(trialsPerSession)].map((_, i) => {
          let bgColor = "bg-slate-200"; // unfilled
          if (i < trialResults.length) {
            bgColor = trialResults[i] ? "bg-emerald-400" : "bg-rose-400";
          } else if (i === currentIndex) {
            bgColor = "bg-slate-300 animate-pulse";
          }
          return (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${bgColor}`} />
          );
        })}
      </div>
    </div>
  );
}
