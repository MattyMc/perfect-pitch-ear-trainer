import React, { useState, useRef } from 'react';
import { 
  BookOpen, ChevronDown, ChevronUp, Play, ArrowLeft, 
  CheckCircle2, AlertTriangle, HelpCircle, Sparkles, 
  ExternalLink, Volume2, ShieldAlert, Heart, Calendar, 
  ListMusic, Award, Compass, MessageSquare
} from 'lucide-react';
import { CHORDS, CHORDS_MAP } from '../chords';
import { AppConfig } from '../db';
import { audio } from '../audio';

interface ParentGuideProps {
  config: AppConfig;
  todaySessionsCount: number;
  recentAccuracy: number;
  onBack: () => void;
  onStartPractice: () => void;
  initialSection?: string;
}

export default function ParentGuide({
  config,
  todaySessionsCount,
  recentAccuracy,
  onBack,
  onStartPractice,
  initialSection = 'quickstart'
}: ParentGuideProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quickstart: true,
    explanation: false,
    trial: false,
    mistakes: false,
    routine: false,
    curriculum: false,
    progress: false,
    plateaus: false,
    laterStages: false,
    timeline: false,
    research: false,
    notReplaced: false,
    comfort: false,
    ...(initialSection && initialSection !== 'quickstart' ? { [initialSection]: true } : {})
  });

  const quickStartRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollToQuickStart = () => {
    quickStartRef.current?.scrollIntoView({ behavior: 'smooth' });
    setOpenSections(prev => ({ ...prev, quickstart: true }));
  };

  // Determine stage and contextual message
  const chordCount = config.activeChordIds.length;
  let stageTitle = "Red Introduction";
  let contextualMessage = "This is guided listening, not a scored quiz.";
  let contextualBg = "bg-rose-50 border-rose-200 text-rose-900";
  let contextualIcon = <Sparkles className="w-5 h-5 text-rose-600" />;

  if (chordCount === 2) {
    stageTitle = "Red & Yellow (2 Chords)";
    contextualMessage = "This is the first genuine identification stage. Focus on calm, neutral exposure.";
    contextualBg = "bg-amber-50 border-amber-200 text-amber-900";
    contextualIcon = <Compass className="w-5 h-5 text-amber-600" />;
  } else if (chordCount >= 5 && chordCount <= 7) {
    stageTitle = `Active Level: ${chordCount} Chords`;
    contextualMessage = "Five to seven chords: A plateau here was common in the reported research program. Keep practicing consistently.";
    contextualBg = "bg-indigo-50 border-indigo-200 text-indigo-900";
    contextualIcon = <HelpCircle className="w-5 h-5 text-indigo-600" />;
  } else if (chordCount > 9) {
    stageTitle = `Phase B: ${chordCount} Chords (Black-key chords)`;
    contextualMessage = "Phase B: Listen to and verify the child's spoken component note names.";
    contextualBg = "bg-purple-50 border-purple-200 text-purple-900";
    contextualIcon = <MessageSquare className="w-5 h-5 text-purple-600" />;
  } else if (chordCount > 2) {
    stageTitle = `Active Level: ${chordCount} Chords`;
    contextualMessage = "Listen for clean first-answer identification without prompting or humming.";
    contextualBg = "bg-blue-50 border-blue-200 text-blue-900";
    contextualIcon = <Compass className="w-5 h-5 text-blue-600" />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-y-auto select-none">
      {/* Header */}
      <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-slate-700 font-semibold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <div className="text-center font-bold text-slate-800 text-base flex items-center space-x-1.5">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span>Parent Method Guide</span>
        </div>
        <button
          onClick={onStartPractice}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Practice</span>
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-16">
        {/* Contextual Guidance Top Card */}
        <div className={`p-4 rounded-2xl border shadow-sm flex items-start space-x-3.5 ${contextualBg}`}>
          <div className="mt-0.5 shrink-0">{contextualIcon}</div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">{stageTitle}</div>
            <div className="text-sm font-medium leading-snug">{contextualMessage}</div>
          </div>
        </div>

        {/* 1. Quick Start Section */}
        <div ref={quickStartRef} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div 
            onClick={() => toggleSection('quickstart')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">1</span>
              <h2 className="text-lg font-bold text-slate-900">Quick Start</h2>
            </div>
            {openSections.quickstart ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.quickstart && (
            <div className="space-y-4 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5">
                <p className="font-bold text-slate-900 text-base">Your job today</p>
                <p className="text-slate-600">
                  Complete <strong>four short sessions</strong>, spread throughout the day. During each trial:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-800 font-medium pl-1">
                  <li>Let the chord play.</li>
                  <li>Let your child choose without help.</li>
                  <li>If correct, the app moves on.</li>
                  <li>If incorrect, the app identifies and replays the correct chord. Your child then taps the correct colour.</li>
                  <li>
                    Keep corrections calm and neutral (e.g. state <em>“That was Yellow”</em> in a flat, reassuring tone without commentary. See Section 4).
                  </li>
                </ol>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-xl text-rose-900 text-xs leading-relaxed space-y-1">
                <strong className="block font-bold">Important: What NOT to do</strong>
                <p>Do not hum the answer, name notes, point toward a colour, or ask whether the sound is higher or lower.</p>
              </div>

              {/* Today's Live Configuration Card */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2.5">
                <div className="text-xs uppercase tracking-wider font-bold text-blue-900">Today's Current Setup</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                    <span className="text-slate-500 block">Current stage</span>
                    <strong className="text-slate-900 text-sm font-semibold">{chordCount === 1 ? 'Red (Intro)' : `${chordCount} Chords Active`}</strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                    <span className="text-slate-500 block">Sessions today</span>
                    <strong className="text-slate-900 text-sm font-semibold">{todaySessionsCount} of 4</strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                    <span className="text-slate-500 block">Trials per session</span>
                    <strong className="text-slate-900 text-sm font-semibold">{config.trialsPerSession} sounds</strong>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100/80">
                    <span className="text-slate-500 block">Next chord</span>
                    <strong className="text-slate-900 text-sm font-semibold">{chordCount < 14 ? 'Manual approval' : 'Complete'}</strong>
                  </div>
                </div>
                <p className="text-xs text-blue-800 font-medium pt-1">
                  💡 Guidance: {chordCount === 1 ? 'Practice hearing the Red chord.' : 'Keep practicing current active chords evenly.'}
                </p>
              </div>

              <button
                onClick={onStartPractice}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-base rounded-xl flex items-center justify-center space-x-2 shadow-md transition-transform active:scale-[0.99]"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Start Practice Session</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. The 15-second explanation */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('explanation')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">2</span>
              <h2 className="text-base font-bold text-slate-900">The 15-second explanation</h2>
            </div>
            {openSections.explanation ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.explanation && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <p>
                The Eguchi method is a long-term listening program developed for young children. A child first learns to associate exact piano chords with colours. More chords are introduced gradually. Later, the child learns the individual note names within those chords and is separately tested on isolated notes.
              </p>
              <p className="text-slate-500 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                It is not ordinary major-versus-minor chord training, and chord-colour accuracy alone does not prove that a child has developed perfect pitch.
              </p>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 3. What happens during a trial */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('trial')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">3</span>
              <h2 className="text-base font-bold text-slate-900">What happens during a trial</h2>
            </div>
            {openSections.trial ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.trial && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="space-y-2">
                {[
                  "The app automatically plays a piano chord.",
                  "The child taps the colour associated with that sound.",
                  "Only the first valid answer is scored for accuracy.",
                  "A correct answer advances immediately to the next trial.",
                  "An incorrect answer starts the calm correction sequence.",
                  "The child taps the correct card before continuing."
                ].map((step, idx) => (
                  <div key={idx} className="flex items-start space-x-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-slate-800">{step}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                <strong>Replay control:</strong> Tapping Replay is allowed and tracked, but does not automatically count as an error.
              </p>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 4. How to respond to mistakes */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('mistakes')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">4</span>
              <h2 className="text-base font-bold text-slate-900">How to respond to mistakes</h2>
            </div>
            {openSections.mistakes ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.mistakes && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900">
                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Exact Parent Script</span>
                <p className="text-base font-semibold">“That was Yellow.”</p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <p>Then:</p>
                <ul className="list-disc list-inside space-y-1 pl-1">
                  <li>Let the app replay the chord.</li>
                  <li>Allow the app to highlight the correct card.</li>
                  <li>Have the child tap the correct colour.</li>
                  <li>Continue without discussing or lecturing about the mistake.</li>
                </ul>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                <span className="font-bold block">Phrases NOT to say:</span>
                <p>• “You know this one.”</p>
                <p>• “Are you sure?”</p>
                <p>• “Listen more carefully.”</p>
                <p>• “It was the other one.”</p>
                <p>• “You keep getting this wrong.”</p>
              </div>
              <p className="text-xs text-slate-500">
                No buzzers, disappointment, score pressure, or punishment should ever be used.
              </p>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 5. The daily routine */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('routine')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">5</span>
              <h2 className="text-base font-bold text-slate-900">The daily routine</h2>
            </div>
            {openSections.routine ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.routine && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                <li><strong>Default:</strong> Four sessions of 25 trials each (~100 trials daily).</li>
                <li><strong>Alternative:</strong> Five sessions of 20 trials.</li>
                <li>Each session takes only <strong>2 to 5 minutes</strong>.</li>
                <li>Spread sessions across the day—never combine into one long session.</li>
                <li>Do not double the next day's practice after a missed day.</li>
                <li>Stop or postpone if your child is tired or resistant.</li>
              </ul>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                <span className="font-bold text-slate-800 block">Sample Daily Schedule</span>
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-slate-600">
                  <div className="p-1.5 bg-white rounded border border-slate-200">1. After breakfast</div>
                  <div className="p-1.5 bg-white rounded border border-slate-200">2. After school</div>
                  <div className="p-1.5 bg-white rounded border border-slate-200">3. Before dinner</div>
                  <div className="p-1.5 bg-white rounded border border-slate-200">4. Before bedtime</div>
                </div>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 6. How chords are introduced & Curriculum */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('curriculum')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">6</span>
              <h2 className="text-base font-bold text-slate-900">How chords are introduced</h2>
            </div>
            {openSections.curriculum ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.curriculum && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <strong className="text-sm font-bold block">Why does training start with Red by itself?</strong>
                <p>
                  In the original Eguchi method, young children (often ages 2–4) begin without prior musical testing experience. The Red-only stage serves two vital pedagogical purposes:
                </p>
                <ul className="list-disc list-inside space-y-1 pl-1 text-amber-950 font-medium">
                  <li><strong>Auditory-Visual Anchor:</strong> It anchors the specific sensory perception of the C-Major chord to the Red card before any discrimination is required.</li>
                  <li><strong>Habituation without Test Anxiety:</strong> It teaches the daily ritual (listen quietly → wait for the sound to finish → tap the card) with 100% success and zero pressure.</li>
                </ul>
                <p className="text-[11px] text-amber-800">
                  True auditory discrimination begins the moment <strong>Yellow</strong> is introduced, requiring the child to contrast two distinct chord timbres.
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">Progression Rules (ALL are mandatory):</span>
                <p>• <strong>14-Day Minimum:</strong> At least 14 days must elapse at each level (~56 sessions or 1,400 trials) to allow deep neurological consolidation.</p>
                <p>• <strong>Rolling 95%+ Accuracy:</strong> High accuracy must be maintained across the most recent 100 trials.</p>
                <p>• <strong>Manual Approval:</strong> Advancement is never automatic; the parent evaluates readiness and confirms the addition of the next chord.</p>
              </div>

              {/* Complete Curriculum List */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Complete Curriculum ({CHORDS.length} Chords)
                  </span>
                  <span className="text-[10px] text-blue-600 font-medium">Tap chord to preview sound</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {CHORDS.map((c) => {
                    const isActive = config.activeChordIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={async () => {
                          await audio.init();
                          audio.playChord(c.midiNotes);
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs border cursor-pointer active:scale-[0.99] transition-all ${
                          isActive ? 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/50' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                        }`}
                        title="Click to play chord sound"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span
                            className="w-5 h-5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.colorHex }}
                          />
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">{c.order}. {c.displayIdentity}</span>
                            <span className="text-[10px] text-slate-500 block">{c.inversionDescription}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-600 font-mono text-[11px]">
                          <span className="font-bold">{c.notesWithOctave}</span>
                          {isActive && <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-sans font-bold">Active</span>}
                          <Volume2 className="w-3.5 h-3.5 text-blue-500 ml-1 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 7. What progress means */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('progress')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">7</span>
              <h2 className="text-base font-bold text-slate-900">What progress means</h2>
            </div>
            {openSections.progress ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.progress && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed">
                <strong className="block font-bold mb-1">⚠️ Crucial Warning for Parents:</strong>
                Strong chord-colour performance is progress in the training method. It should not be described as “perfect pitch achieved.” Absolute pitch must be evaluated separately using isolated notes without hints or feedback.
              </div>

              <div className="space-y-2 text-xs">
                <div><strong>• First-answer accuracy:</strong> How often the first colour selected was correct.</div>
                <div><strong>• Replay rate:</strong> How often your child requested to hear the sound again.</div>
                <div><strong>• Confusions:</strong> Which chord was chosen instead of the correct one.</div>
                <div><strong>• Consistency:</strong> How regularly short daily sessions are completed.</div>
                <div><strong>• Days at this level:</strong> Time elapsed since the newest chord was introduced.</div>
                <div><strong>• Mastery eligibility:</strong> Whether all strict criteria (14+ days, 100 clean consecutive trials, balanced coverage) are satisfied.</div>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 8. Plateaus are expected */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('plateaus')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">8</span>
              <h2 className="text-base font-bold text-slate-900">Plateaus are expected</h2>
            </div>
            {openSections.plateaus ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.plateaus && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <p className="text-xs">
                Many children in the published study progressed more slowly after approximately five to seven chords. A plateau may last for weeks. This does not mean the child is failing.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs space-y-1">
                <span className="font-bold text-slate-900 block">During a plateau, DO NOT:</span>
                <p>• Introduce another chord merely for variety.</p>
                <p>• Change chord sounds or instruments.</p>
                <p>• Create extra isolated-note drills.</p>
                <p>• Increase session length to force progress.</p>
                <p>• Use accuracy percentages to pressure the child.</p>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 9. Later stages (Phase B) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('laterStages')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">9</span>
              <h2 className="text-base font-bold text-slate-900">Later stages (Phase B)</h2>
            </div>
            {openSections.laterStages ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.laterStages && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <p className="text-xs">
                After all nine white-key chords are mastered:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                <li>The response changes from colours to <strong>spoken note names</strong>.</li>
                <li>The child says every component note in the chord aloud.</li>
                <li>Five chords containing black-key notes are added one by one.</li>
                <li>An adult must supervise and verify spoken responses (the app avoids privacy-invasive speech recording).</li>
                <li>Optional inversions are an advanced option and should not be activated casually.</li>
              </ul>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 10. Timeline and commitment */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('timeline')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">10</span>
              <h2 className="text-base font-bold text-slate-900">Timeline and commitment</h2>
            </div>
            {openSections.timeline ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.timeline && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <p className="text-xs">
                This is not a short game or a few-week course. In the main published study, completing the acquisition phase commonly took roughly <strong>one to two years</strong>. Maintenance continued until approximately age nine. Families should expect uneven progress and occasional missed days.
              </p>
              <p className="text-xs text-slate-500">
                There is no guarantee that every child will acquire absolute pitch.
              </p>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 11. Research and limitations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('research')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">11</span>
              <h2 className="text-base font-bold text-slate-900">Research and limitations</h2>
            </div>
            {openSections.research ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.research && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-100 text-xs text-blue-950 space-y-1.5">
                <span className="font-bold text-blue-900 block text-sm">Study Outcome & Final Criterion:</span>
                <p>
                  In the landmark Sakakibara (2014) longitudinal study, 24 children aged 2–6 were trained using this exact chord-identification progression. Twenty-two children completed all stages.
                </p>
                <p>
                  <strong>What the children could do:</strong> Upon completing the protocol, all 22 children achieved the study's strict absolute pitch criterion: identifying <strong>randomized, isolated individual piano notes</strong> across the keyboard (from C3 to B5) with 100% or near-perfect accuracy without any reference pitch or hesitation.
                </p>
                <p className="text-[11px] text-blue-800">
                  The training duration required to reach this stage averaged <strong>1.5 to 2 years</strong> (with maintenance practice continuing until ~age 9).
                </p>
              </div>

              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                <li>Training was intensive (4–5 short daily sessions) and administered by parents at home.</li>
                <li>There was no randomized control group in the original observational study.</li>
                <li>Results demonstrate critical-period plasticity, but do not guarantee identical outcomes for every child.</li>
              </ul>

              <div className="space-y-2 pt-1 text-xs">
                <span className="font-bold text-slate-900 block">Primary Published Sources:</span>
                <a
                  href="https://doi.org/10.1177/0305735612463948"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-blue-600 hover:bg-slate-100"
                >
                  <span className="font-medium text-[11px]">Sakakibara (2014) Psychology of Music</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://www.ganbar.us/documents/sakakibara_2012_chord_identification.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-blue-600 hover:bg-slate-100"
                >
                  <span className="font-medium text-[11px]">Accessible Manuscript (PDF)</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://www.jstage.jst.go.jp/article/jjep1953/47/1/47_19/_article"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-blue-600 hover:bg-slate-100"
                >
                  <span className="font-medium text-[11px]">Sakakibara (1999) Japanese Report</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 12. What this method does not replace */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('notReplaced')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">12</span>
              <h2 className="text-base font-bold text-slate-900">What this method does not replace</h2>
            </div>
            {openSections.notReplaced ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.notReplaced && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <p className="text-xs">
                Children still benefit from normal, joyful musical activities alongside this tool:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Singing</div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Rhythm & movement</div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Playing instruments</div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Improvisation</div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Reading music</div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">• Enjoying music freely</div>
              </div>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>

        {/* 13. Child comfort (When should we pause?) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div 
            onClick={() => toggleSection('comfort')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center">13</span>
              <h2 className="text-base font-bold text-slate-900">When should we pause?</h2>
            </div>
            {openSections.comfort ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>

          {openSections.comfort && (
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed pt-1">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1">
                <strong className="block font-bold">Pause immediately when your child is:</strong>
                <p>• Upset or anxious about making mistakes.</p>
                <p>• Consistently refusing or resisting practice.</p>
                <p>• Too tired or distracted to attend.</p>
                <p>• Experiencing discomfort from the volume.</p>
                <p>• Treating sessions as a conflict with you.</p>
              </div>
              <p className="text-xs text-slate-600">
                Return later calmly without penalties or make-up marathons.
              </p>
              <button onClick={scrollToQuickStart} className="text-xs text-blue-600 font-bold hover:underline block pt-1">
                ↑ Back to Quick Start
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
