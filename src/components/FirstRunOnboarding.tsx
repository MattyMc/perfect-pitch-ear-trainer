import { useState } from 'react';
import { Ear, Palette, Sparkles, Clock, CheckCircle2, Music2, ArrowRight } from 'lucide-react';
import { db } from '../db';
import { audio } from '../audio';

interface FirstRunOnboardingProps {
  onComplete: (action: 'quickstart' | 'guide' | 'practice') => void;
}

export default function FirstRunOnboarding({ onComplete }: FirstRunOnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const finish = async (action: 'quickstart' | 'guide' | 'practice') => {
    await audio.init();
    await db.config.update('config', { hasCompletedOnboarding: true });
    onComplete(action);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none overflow-y-auto">
      {/* Progress Dots */}
      <div className="flex justify-center space-x-2 pt-12 pb-4">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-300 ${
              s === step ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700'
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full pb-10">
        {/* Screen 1 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-8 animate-fadeIn">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 rounded-2xl bg-blue-500/10 text-blue-400 mb-2">
                <Music2 className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">What your child will do</h1>
              <p className="text-slate-300 leading-relaxed text-base">
                Your child will learn to recognize specific piano chords and associate each one with a colour. The app plays a chord, and your child taps the matching colour.
              </p>
            </div>

            {/* Non-interactive visual flow */}
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 shadow-lg space-y-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold text-center">
                The Simple Practice Loop
              </div>
              <div className="grid grid-cols-3 gap-2 text-center items-center">
                <div className="flex flex-col items-center p-3 rounded-xl bg-slate-700/60">
                  <Ear className="w-7 h-7 text-blue-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-200">1. Listen</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-slate-700/60">
                  <Palette className="w-7 h-7 text-yellow-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-200">2. Choose</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-slate-700/60">
                  <Sparkles className="w-7 h-7 text-green-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-200">3. Feedback</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Screen 2 */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-fadeIn">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 text-amber-400 mb-1">
                <Clock className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">What you will do</h1>
              <p className="text-slate-300 leading-relaxed text-sm">
                Help your child complete four short sessions throughout the day. Each session contains 25 sounds and usually takes only a few minutes. Stay nearby, but do not give hints.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-3 shadow-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200"><strong>4 short sessions</strong> daily (approx. 100 trials total)</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200"><strong>2 to 5 minutes</strong> per session</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200"><strong>Distributed throughout the day</strong> (e.g. morning, afternoon, evening)</span>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-200"><strong>Calm, neutral supervision</strong> with no musical knowledge needed</span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep(1)}
                className="py-4 px-6 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-2xl font-bold text-slate-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg transition-colors"
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Screen 3 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-fadeIn">
            <div className="text-center space-y-3">
              <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 text-rose-400 mb-1">
                <div className="w-8 h-8 rounded-full bg-rose-500 shadow-md" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">How training begins</h1>
              <p className="text-slate-300 leading-relaxed text-sm">
                First, the app introduces the <strong>Red</strong> sound. This is listening practice, not a test. The first real choice begins when Red and Yellow are both available.
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                • <strong>Red familiarization:</strong> Your child simply listens and taps Red a few times to learn the sound.
              </p>
              <p>
                • <strong>Red & Yellow:</strong> Once Yellow is introduced, your child will identify which sound was played.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => finish('practice')}
                className="w-full py-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-2xl font-bold text-lg text-white shadow-lg transition-colors flex items-center justify-center space-x-2"
              >
                <span>Introduce Red (Start Now)</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={() => finish('quickstart')}
                className="w-full py-3.5 bg-blue-600/30 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 rounded-2xl font-bold text-base transition-colors"
              >
                Show me the Quick Start
              </button>

              <button
                onClick={() => finish('guide')}
                className="w-full py-3 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Read the full method guide
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
