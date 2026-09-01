import { useState, useEffect, useRef } from 'react';
import { CHORDS_MAP } from '../chords';
import { audio } from '../audio';
import { Check, Ear } from 'lucide-react';
import { db } from '../db';
import HoldToExit from './HoldToExit';

export default function IntroMode({ chordId, onExit }: { chordId: string, onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [sessionId, setSessionId] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [statusText, setStatusText] = useState<'listening' | 'tap' | 'confirmed'>('listening');
  const isMountedRef = useRef(true);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    const sid = crypto.randomUUID();
    setSessionId(sid);
    
    db.sessions.add({
      id: sid,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      endedAt: null,
      status: 'active',
      endReason: null,
      scoredTrialCount: 0,
      plannedTrialCount: 3,
      sequence: [],
    });
    
    const initIntro = async () => {
      await audio.init();
      if (!isMountedRef.current) return;
      
      // Step 1: Spoken intro prompt
      setStatusText('listening');
      setIsPlaying(true);
      await audio.speak("Listen to the sound, then tap the card.");
      if (!isMountedRef.current) return;
      
      // Brief pause before first chord
      await new Promise(r => setTimeout(r, 400));
      if (!isMountedRef.current) return;
      
      runStep(0, sid);
    };

    const t = setTimeout(() => {
      initIntro();
    }, 300);

    return () => {
      isMountedRef.current = false;
      clearTimeout(t);
    };
  }, [chordId]);

  const runStep = async (currentStep: number, sid = sessionId) => {
    if (!isMountedRef.current) return;
    
    isProcessingRef.current = true;

    if (currentStep >= 3) {
      setStep(3);
      if (sid) {
        db.sessions.update(sid, { status: 'completed', endReason: 'target_reached', endedAt: Date.now(), scoredTrialCount: 3 });
      }
      return;
    }
    
    setStep(currentStep);
    setIsPlaying(true);
    setStatusText('listening');

    await audio.init();
    const chord = CHORDS_MAP.get(chordId)!;
    
    // 1. Play acoustic piano chord (lasts 2.2 seconds)
    audio.playChord(chord.midiNotes);
    await new Promise(r => setTimeout(r, 2200));
    if (!isMountedRef.current) return;

    // 2. Speak color name (e.g. "Red")
    await audio.speak(chord.displayIdentity);
    if (!isMountedRef.current) return;

    // 3. Enable button for child to tap
    setIsPlaying(false);
    setStatusText('tap');
    isProcessingRef.current = false;
  };

  const handleTap = async () => {
    if (isPlaying || step >= 3 || !isMountedRef.current || isProcessingRef.current) return;
    
    isProcessingRef.current = true;

    // 1. Instantly lock and show confirmation
    setIsPlaying(true);
    setStatusText('confirmed');
    
    // 2. Play pleasant success chime
    audio.playSuccessTone();
    
    // 3. Allow success chime and visual feedback to finish
    await new Promise(r => setTimeout(r, 800));
    if (!isMountedRef.current) return;

    const nextStep = step + 1;
    if (nextStep >= 3) {
      setStep(3);
      if (sessionId) {
        await db.sessions.update(sessionId, { status: 'completed', endReason: 'target_reached', endedAt: Date.now(), scoredTrialCount: 3 });
      }
    } else {
      // Brief inter-trial pause before next chord
      await new Promise(r => setTimeout(r, 300));
      if (!isMountedRef.current) return;
      runStep(nextStep);
    }
  };

  const chord = CHORDS_MAP.get(chordId)!;

  if (step >= 3) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 bg-slate-50">
        <div className="w-32 h-32 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-16 h-16 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Done!</h2>
        <button 
          onClick={onExit}
          className="px-12 py-4 bg-blue-500 text-white rounded-full text-2xl font-bold shadow-lg active:scale-95 transition-transform"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none touch-manipulation">
      <div className="flex justify-between items-center p-4 pt-12 pb-2">
        <HoldToExit onExit={onExit} />
        <div className="flex-1 flex justify-center space-x-3 items-center">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-full transition-colors ${i < step ? 'bg-blue-500' : 'bg-slate-200'}`} />
          ))}
        </div>
        <div className="w-12" /> 
      </div>

      <div className="flex items-center justify-center h-32 mb-4">
        { statusText === 'listening' ? (
           <div className="flex flex-col items-center space-y-2">
             <div className="relative flex items-center justify-center">
               <Ear className="w-14 h-14 text-blue-500 animate-pulse relative z-10" />
               <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
             </div>
             <span className="text-sm font-semibold text-blue-600">Listen</span>
           </div>
        ) : statusText === 'confirmed' ? (
           <div className="flex items-center space-x-2 text-green-600 font-bold text-lg">
             <Check className="w-7 h-7" />
             <span>Great!</span>
           </div>
        ) : (
           <div className="text-xl font-bold text-slate-600 animate-bounce">
             Tap the {chord.displayIdentity} card
           </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-8 mb-[env(safe-area-inset-bottom)]">
        <button
          onClick={handleTap}
          disabled={isPlaying}
          className={`w-full max-w-[280px] aspect-square rounded-[3rem] shadow-xl transition-all duration-300 ${
            isPlaying 
              ? statusText === 'confirmed'
                ? 'opacity-100 scale-105 ring-4 ring-green-400'
                : 'opacity-40 scale-95 pointer-events-none' 
              : 'opacity-100 scale-100 active:scale-95 cursor-pointer'
          }`}
          style={{ backgroundColor: chord.colorHex }}
        />
      </div>
    </div>
  );
}
