import React, { useState, useEffect, useRef } from 'react';
import { Ear, RotateCw, Check } from 'lucide-react';
import { CHORDS_MAP } from '../chords';
import { audio } from '../audio';
import { db, checkAndCloseStaleSessions, getResumeableSession, endSession } from '../db';
import { generateSessionSequence } from '../utils/scheduler';
import HoldToExit from './HoldToExit';
import PracticeDone from './PracticeDone';

interface PracticeProps {
  activeChordIds: string[];
  trialsPerSession: number;
  onExit: () => void;
}

type TrialState = 'Initializing' | 'NeedsResumeTap' | 'Ready' | 'Playing' | 'Awaiting' | 'Correct' | 'Correcting' | 'PlayingCorrection' | 'CorrectionTap' | 'Done';

export default function Practice({ activeChordIds, trialsPerSession, onExit }: PracticeProps) {
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
  const [currentTrialId, setCurrentTrialId] = useState<string>(crypto.randomUUID());

  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  const isScoredSession = activeChordIds.length > 1;

  useEffect(() => {
    isMountedRef.current = true;

    async function initSession() {
      if (isScoredSession) {
        await checkAndCloseStaleSessions();
        const active = await getResumeableSession();
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

      const sid = crypto.randomUUID();
      setSessionId(sid);
      const seq = generateSessionSequence(activeChordIds, trialsPerSession);
      setSequence(seq);
      
      if (isScoredSession) {
        await db.sessions.add({
          id: sid,
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
          startTrial(seq[0], 0, sid);
        }
      }, 400);
    }

    initSession();

    return () => {
      isMountedRef.current = false;
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

  const startTrial = async (chordId: string, idx: number, sid = sessionId) => {
    if (!isMountedRef.current) return;
    
    setTrialState('Playing');
    isProcessingRef.current = true;
    updateActivity(sid);

    try {
      await audio.init();
    } catch (err: any) {
      if (isMountedRef.current) setAudioError(err.message || 'Audio failed to load');
      isProcessingRef.current = false;
      return;
    }
    
    const chord = CHORDS_MAP.get(chordId);
    if (chord) {
      // 1. Play chord sound (2.2s)
      audio.playChord(chord.midiNotes);
      await new Promise(r => setTimeout(r, 2200));
      if (!isMountedRef.current) return;

      // 2. Open answering window
      setTrialState('Awaiting');
      isProcessingRef.current = false;
    }
  };

  const handleReplay = async () => {
    if ((trialState !== 'Awaiting' && trialState !== 'CorrectionTap') || !currentChordId || !isMountedRef.current || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    updateActivity();
    setReplayCount(prev => prev + 1);
    const prevState = trialState;
    setTrialState(prevState === 'Awaiting' ? 'Playing' : 'PlayingCorrection');

    try {
      await audio.init();
    } catch (err: any) {
      if (isMountedRef.current) setAudioError(err.message || 'Audio failed to load');
      setTrialState(prevState);
      isProcessingRef.current = false;
      return;
    }

    const chord = CHORDS_MAP.get(currentChordId);
    if (chord) {
      audio.playChord(chord.midiNotes);
      await new Promise(r => setTimeout(r, 2200));
      if (!isMountedRef.current) return;
      setTrialState(prevState);
      isProcessingRef.current = false;
    } else {
      isProcessingRef.current = false;
    }
  };

  const saveTrial = async (correct: boolean, firstAns: string | null, isComplete = true) => {
    if (!currentChordId) return;

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
      await db.trials.put({
        id: currentTrialId,
        sessionId,
        sequenceIndex: currentIndex,
        presentedChordId: currentChordId,
        presentedGridIndex,
        replayCount,
        firstAnswerChordId: firstAns,
        firstAnswerGridIndex,
        firstAnswerCorrect: correct,
        completedAtUtc: Date.now(),
        correctionTapCount: correctionTaps,
        correctionIncomplete: !isComplete,
      });
      
      const isCompleted = isComplete && (currentIndex + 1 >= trialsPerSession);
      if (isComplete) {
        await db.sessions.update(sessionId, {
          scoredTrialCount: currentIndex + 1,
          lastActivityAt: Date.now(),
          status: isCompleted ? 'completed' : 'active',
          endReason: isCompleted ? 'target_reached' : null,
          endedAt: isCompleted ? Date.now() : null
        });
      } else {
        await db.sessions.update(sessionId, {
          lastActivityAt: Date.now()
        });
      }
    }
    updateActivity();
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
      setCurrentTrialId(crypto.randomUUID());

      // Brief silent pause before presenting next stimulus
      await new Promise(r => setTimeout(r, 350));
      if (!isMountedRef.current) return;

      updateActivity();
      startTrial(sequence[nextIdx], nextIdx);
    }
  };

  const isInputLocked = trialState !== 'Awaiting' && trialState !== 'CorrectionTap';

  const handleCardTap = async (tappedChordId: string) => {
    if (!isMountedRef.current || !currentChordId || isInputLocked || isProcessingRef.current) return;
    
    isProcessingRef.current = true;

    if (trialState === 'Awaiting') {
      const isCorrect = tappedChordId === currentChordId;
      setFirstAnswerId(tappedChordId);
      
      if (isCorrect) {
        setTrialState('Correct');
        audio.playSuccessTone();
        await saveTrial(true, tappedChordId, true);
        
        // Let success chime finish
        await new Promise(r => setTimeout(r, 850));
        if (!isMountedRef.current) return;
        advanceTrial();
      } else {
        await saveTrial(false, tappedChordId, false);
        setTrialState('Correcting');
        const correctChord = CHORDS_MAP.get(currentChordId)!;
        
        // 1. Speak neutral correction
        await audio.speak(`That was ${correctChord.displayIdentity}`);
        if (!isMountedRef.current) return;

        await new Promise(r => setTimeout(r, 300));
        if (!isMountedRef.current) return;

        // 2. Replay correct chord
        setTrialState('PlayingCorrection');
        audio.playChord(correctChord.midiNotes);
        await new Promise(r => setTimeout(r, 2200));
        if (!isMountedRef.current) return;

        // 3. Allow correction tap on target card
        setTrialState('CorrectionTap');
        isProcessingRef.current = false;
      }
    } else if (trialState === 'CorrectionTap') {
      if (tappedChordId === currentChordId) {
        setTrialState('Correct');
        audio.playSuccessTone();
        await saveTrial(false, firstAnswerId, true);

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
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 bg-slate-50">
        <h2 className="text-3xl font-bold text-slate-800">Ready to continue?</h2>
        <button 
          onClick={() => {
            if (!isMountedRef.current) return;
            startTrial(sequence[currentIndex], currentIndex, sessionId);
          }}
          className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-2xl font-bold shadow-lg active:scale-95 transition-transform"
        >
          Continue
        </button>
      </div>
    );
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
            if (isDisabled) {
               pointerEvents = "pointer-events-none";
            }

            return (
              <button
                key={id}
                onClick={() => handleCardTap(id)}
                disabled={isDisabled}
                className={`relative overflow-hidden rounded-[2rem] shadow-sm transition-all duration-300 ${!isDisabled ? 'active:scale-95' : ''} ${opacity} ${scale} ${pointerEvents} ${extraStyles}`}
                style={{ backgroundColor: chord.colorHex, minHeight: '72px' }}
              >
                {(trialState === 'CorrectionTap' && isTarget) && (
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
          } else if (i === currentIndex && trialState !== 'Done') {
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
