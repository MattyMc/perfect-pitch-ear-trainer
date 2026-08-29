import React from 'react';
import { Check } from 'lucide-react';
import { CHORDS_MAP } from '../chords';

interface PracticeDoneProps {
  trialResults: boolean[];
  sequence: string[];
  isScoredSession: boolean;
  onExit: () => void;
}

export default function PracticeDone({ trialResults, sequence, isScoredSession, onExit }: PracticeDoneProps) {
  const correctAnswers = trialResults.filter(Boolean).length;
  const totalAnswers = trialResults.length;
  const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  let encouragement = "Keep practicing!";
  if (accuracy === 100) encouragement = "Perfect score!";
  else if (accuracy >= 80) encouragement = "Amazing job!";
  else if (accuracy >= 60) encouragement = "Great effort!";

  const chordStats = new Map<string, { total: number, correct: number }>();
  for (let i = 0; i < totalAnswers; i++) {
    const chordId = sequence[i];
    if (!chordStats.has(chordId)) chordStats.set(chordId, { total: 0, correct: 0 });
    chordStats.get(chordId)!.total += 1;
    if (trialResults[i]) chordStats.get(chordId)!.correct += 1;
  }

  const strongChords: string[] = [];
  const reviewChords: string[] = [];
  
  Array.from(chordStats.entries()).forEach(([chordId, stats]) => {
    const chordAcc = stats.correct / stats.total;
    if (chordAcc >= 0.7) strongChords.push(chordId);
    else reviewChords.push(chordId);
  });

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50 p-6 text-center">
      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center shadow-md">
        <Check className="w-12 h-12 text-green-600" />
      </div>
      <h2 className="text-3xl font-bold text-slate-800">{isScoredSession ? encouragement : 'Done!'}</h2>
      
      {isScoredSession && (
        <div className="flex flex-col items-center space-y-6 w-full max-w-sm pb-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 w-full flex flex-col items-center">
            <span className="text-slate-500 font-medium uppercase tracking-wider text-xs mb-2">Final Score</span>
            <div className="text-5xl font-extrabold text-blue-600 mb-2">
              {correctAnswers} <span className="text-3xl text-slate-400">/ {totalAnswers}</span>
            </div>
            <span className="text-sm font-bold text-slate-400">{accuracy}% Accuracy</span>
          </div>

          {(strongChords.length > 0 || reviewChords.length > 0) && (
            <div className="flex w-full space-x-3">
              {strongChords.length > 0 && (
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Nailed It</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {strongChords.map(id => (
                      <div key={id} className="w-6 h-6 rounded-full shadow-sm ring-1 ring-slate-200" style={{ backgroundColor: CHORDS_MAP.get(id)?.colorHex }} />
                    ))}
                  </div>
                </div>
              )}
              {reviewChords.length > 0 && (
                <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">Practice More</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {reviewChords.map(id => (
                      <div key={id} className="w-6 h-6 rounded-full shadow-sm ring-1 ring-slate-200" style={{ backgroundColor: CHORDS_MAP.get(id)?.colorHex }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button 
        onClick={onExit}
        className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xl font-bold shadow-lg active:scale-95 transition-transform"
      >
        Go Home
      </button>
    </div>
  );
}
