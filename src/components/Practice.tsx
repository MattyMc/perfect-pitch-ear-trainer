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

type TrialState = 'Initializing' | 'NeedsResumeTap' | 'Ready' | 'Playing' | 'Awaiting' | 'Correct' | 'Correcting' | 'PlayingCorrection' | 'CorrectionTap' | 'Done';

export default function Practice({ profileId, activeChordIds, trialsPerSession, chordDurationMs, inputLockMs, chordLabels, onExit }: PracticeProps) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trialState, setTrialState] = useState<TrialState>('Initializing');
  
  // Trial tracking
  const [sessionId, setSessionId] = useState<string>('');
  const [replayCount, setReplayCount] = useState(0);
  const [firstAnswerId, setFirstAnswerId] = useState<string | null>(null);
  const [correctionTaps, setCorrectionTaps] = useState(0);
  const [trialResults, setTrialResults] = useState<boolean[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTrialId, setCurrentTrialId] = useState<string>(newId());

  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

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

    isProcessingRef.current = true;
    updateActivity();
    const prevState = trialState;
    setTrialState(prevState === 'Awaiting' ? 'Playing' : 'PlayingCorrection');

    const result = await playOrReport(chord.midiNotes);
    if (!isMountedRef.current) return;
    if (result === 'played') {
      // Counted only when it played, so a replay the child never heard isn't saved.
      setReplayCount(prev => prev + 1);
      await new Promise(r => setTimeout(r, inputLockMs));
      if (!isMountedRef.current) return;
    }
    // Replay is itself a tap, so 'needs-tap' just means "press it again".
    setTrialState(prevState);
    isProcessingRef.current = false;
  };

  /**
   * Persists the trial. Resolves false when the session row has gone (the parent reset or
   * deleted this profile from another tab), in which case nothing was written and the caller
   * should leave.
   */
  const saveTrial = async (correct: boolean, firstAns: string | null, isComplete = true): Promise<boolean> => {
    if (!currentChordId) return true;

    if (isComplete && !trialResults[currentIndex]) {
       // Only add to results array when fully completed to avoid double entry
       setTrialResults(prev => {
         const newResults = [...prev];
         newResults[currentIndex] = correct;
         return newResults;
       });
    }

    const presentedGridIndex = activeChordIds.indexOf(currentChordId);
    const firstAnswerGridIndex = firstAns ? activeChordIds.indexOf(firstAns) : undefined;

    if (isScoredSession) {
      const now = Date.now();
      const isCompleted = isComplete && (currentIndex + 1 >= trialsPerSession);
      const sessionPatch = isComplete
        ? {
            scoredTrialCount: currentIndex + 1,
            lastActivityAt: now,
            status: isCompleted ? 'completed' as const : 'active' as const,
            endReason: isCompleted ? 'target_reached' as const : null,
            endedAt: isCompleted ? now : null,
          }
        : { lastActivityAt: now };

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
        correctionTapCount: correctionTaps,
        correctionIncomplete: !isComplete,
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
      setFirstAnswerId(null);
      setCorrectionTaps(0);
      setCurrentTrialId(newId());

      // Brief silent pause before presenting next stimulus
      await new Promise(r => setTimeout(r, 350));
      if (!isMountedRef.current) return;

      updateActivity();
      startTrial(sequence[nextIdx]);
    }
  };

  const isInputLocked = trialState !== 'Awaiting' && trialState !== 'CorrectionTap';

  const handleCardTap = async (tappedChordId: string) => {
    if (!isMountedRef.current || !currentChordId || isInputLocked || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    // A tap during the chord answers it, so the chord stops rather than ringing under the
    // chime or the spoken correction.
    audio.stopChord();

    if (trialState === 'Awaiting') {
      const isCorrect = tappedChordId === currentChordId;
      setFirstAnswerId(tappedChordId);
      
      if (isCorrect) {
        setTrialState('Correct');
        audio.playSuccessTone();
        if (!(await saveTrial(true, tappedChordId, true))) return;
        
        // Let success chime finish
        await new Promise(r => setTimeout(r, 850));
        if (!isMountedRef.current) return;
        advanceTrial();
      } else {
        if (!(await saveTrial(false, tappedChordId, false))) return;
        setTrialState('Correcting');
        const correctChord = CHORDS_MAP.get(currentChordId)!;
        
        // 1. Speak neutral correction
        await audio.speak(`That was ${correctChord.displayIdentity}`);
        if (!isMountedRef.current) return;

        await new Promise(r => setTimeout(r, 300));
        if (!isMountedRef.current) return;

        // 2. Replay correct chord. The wrong tap may have just rebuilt the audio (after a return
        // from the background); play() waits until the piano is ready. If sound needs another
        // tap, skip the replay rather than show Continue, which would restart the trial and let
        // the next tap count as a first answer. Replay is itself a tap and can bring it back.
        setTrialState('PlayingCorrection');
        const result = await playOrReport(correctChord.midiNotes);
        if (!isMountedRef.current) return;
        if (result === 'failed') {
          isProcessingRef.current = false;
          return;
        }
        if (result === 'played') {
          await new Promise(r => setTimeout(r, inputLockMs));
          if (!isMountedRef.current) return;
        }

        // 3. Allow correction tap on target card
        setTrialState('CorrectionTap');
        isProcessingRef.current = false;
      }
    } else if (trialState === 'CorrectionTap') {
      if (tappedChordId === currentChordId) {
        setTrialState('Correct');
        audio.playSuccessTone();
        if (!(await saveTrial(false, firstAnswerId, true))) return;

        // Let success chime finish
        await new Promise(r => setTimeout(r, 850));
        if (!isMountedRef.current) return;
        advanceTrial();
      } else {
        setCorrectionTaps(prev => prev + 1);
        isProcessingRef.current = false;
      }
    }
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
        { (trialState === 'Correcting' || trialState === 'PlayingCorrection') ? (
           <div className="flex flex-col items-center space-y-2">
             <span className="text-2xl font-bold text-slate-800">
               {trialState === 'Correcting' ? `That was ${currentChord?.displayIdentity}!` : `Listen to ${currentChord?.displayIdentity}`}
             </span>
             {trialState === 'PlayingCorrection' && (
                <div className="flex items-center space-x-2 text-blue-500">
                  <Ear className="w-6 h-6 animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-wider">Playing</span>
                </div>
             )}
           </div>
        ) : trialState === 'Playing' ? (
           <div className="flex flex-col items-center space-y-1.5">
             <div className="relative flex items-center justify-center">
               <Ear className="w-12 h-12 text-blue-500 animate-pulse relative z-10" />
               <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
             </div>
             <span className="text-xs font-semibold text-blue-600">Listen</span>
           </div>
        ) : (trialState === 'Awaiting') ? (
           <button 
             onClick={handleReplay} 
             className="p-3 px-6 bg-white text-blue-600 rounded-full active:bg-blue-50 hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2 shadow-sm border border-blue-100 cursor-pointer"
           >
             <RotateCw className="w-6 h-6" />
             <span className="text-base font-bold">Replay</span>
           </button>
        ) : trialState === 'CorrectionTap' ? (
           <div className="flex flex-col items-center space-y-2">
             <span className="text-2xl font-bold text-slate-800">
               Tap {currentChord?.displayIdentity}
             </span>
             <button 
               onClick={handleReplay} 
               className="p-2 px-4 bg-white text-blue-600 rounded-full active:bg-blue-50 hover:bg-slate-50 transition-colors flex items-center justify-center space-x-1.5 shadow-sm border border-blue-100 cursor-pointer text-sm font-bold"
             >
               <RotateCw className="w-4 h-4" />
               <span>Replay</span>
             </button>
           </div>
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
            const isCorrectionPhase = trialState === 'Correcting' || trialState === 'PlayingCorrection' || trialState === 'CorrectionTap';
            
            let opacity = "opacity-100";
            let scale = "scale-100";
            let pointerEvents = "pointer-events-auto cursor-pointer";
            let extraStyles = "";
            
            if (isCorrectionPhase) {
               if (isTarget) {
                 opacity = "opacity-100 z-10";
                 scale = "scale-110";
                 extraStyles = "ring-8 ring-blue-500 shadow-2xl";
                 if (trialState === 'CorrectionTap') {
                   extraStyles += " animate-pulse";
                 }
               } else {
                 opacity = "opacity-10";
                 scale = "scale-75";
                 extraStyles = "grayscale";
                 pointerEvents = "pointer-events-none";
                 
                 // Highlight the incorrectly tapped card briefly
                 if (firstAnswerId === id && trialState === 'Correcting') {
                    extraStyles += " ring-4 ring-red-400 opacity-60";
                 }
               }
            } else if (trialState === 'Playing') {
               opacity = "opacity-40 grayscale-[0.2]";
               pointerEvents = "pointer-events-none";
            }
            
            if (trialState === 'Correct' && isTarget) {
               scale = "scale-105 shadow-xl ring-4 ring-green-400";
            }
            
            const isDisabled = isInputLocked || (isCorrectionPhase && !isTarget);
            const showsPointer = trialState === 'CorrectionTap' && isTarget;
            const label = chordLabel(chord, chordLabels);
            if (isDisabled) {
               pointerEvents = "pointer-events-none";
            }

            return (
              <button
                key={id}
                data-chord-id={id}
                onClick={() => handleCardTap(id)}
                disabled={isDisabled}
                className={`relative overflow-hidden rounded-[2rem] shadow-sm transition-all duration-300 ${!isDisabled ? 'active:scale-95' : ''} ${opacity} ${scale} ${pointerEvents} ${extraStyles}`}
                style={{ backgroundColor: chord.colorHex, minHeight: '72px' }}
              >
                {label && !showsPointer && (
                   <span
                     className="absolute inset-0 flex items-center justify-center text-3xl font-black tracking-tight"
                     style={{ color: labelInkFor(chord.colorHex) }}
                   >
                     {label}
                   </span>
                )}
                {showsPointer && (
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 bg-white/40 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner animate-bounce">
                         <span className="text-3xl relative top-1 drop-shadow-sm">👆</span>
                      </div>
                   </div>
                )}
              </button>
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
