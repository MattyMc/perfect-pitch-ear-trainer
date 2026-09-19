import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, Profile, AppConfig, completedSessionsTodayQuery, recentTrialsQuery,
  createProfile, setActiveProfile, updateProfile, deleteProfile, resetProfileData, setOnboardingCompleted,
  suggestProfileColour,
} from '../db';
import { CHORDS, CHORDS_MAP } from '../chords';
import { audio } from '../audio';
import { 
  BarChart2, Settings, Download, BookOpen,
  HelpCircle, ArrowLeft, CheckCircle2, XCircle,
  Sparkles, RefreshCw, Info, Volume2,
  Users, Pencil, Trash2, Plus, Check
} from 'lucide-react';
import ParentGuide from './ParentGuide';
import ProfileForm from './ProfileForm';
import ProfileDot from './ProfileDot';

const secondaryButtonClass = 'w-full py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 flex items-center justify-center space-x-2 rounded-xl font-bold text-xs transition-colors';
const inlineFormClass = 'p-3.5 bg-slate-50 rounded-xl border border-slate-200/80';

interface ParentDashboardProps {
  profile: Profile;
  /** The active profile's config, from App's single snapshot — not re-queried here. */
  config: AppConfig;
  profiles: Profile[];
  onExit: () => void;
  onStartPractice: () => void;
}

export default function ParentDashboard({ profile, config, profiles, onExit, onStartPractice }: ParentDashboardProps) {
  const [subView, setSubView] = useState<'dashboard' | 'guide'>('dashboard');
  const [guideSection, setGuideSection] = useState<string>('quickstart');
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  // At most one profile form is open at a time: adding, or renaming one profile.
  const [editing, setEditing] = useState<'add' | { rename: string } | null>(null);

  const profileId = profile.id;
  const recentTrials = useLiveQuery(() => recentTrialsQuery(profileId), [profileId]);

  // Calculate today's completed sessions
  const todaySessions = useLiveQuery(() => completedSessionsTodayQuery(profileId), [profileId]);

  const todaySessionsCount = todaySessions?.length || 0;

  const openGuideAt = (section: string) => {
    setGuideSection(section);
    setSubView('guide');
  };

  const addChord = async () => {
    const allChordIds = CHORDS.map(c => c.id);
    if (config.activeChordIds.length < allChordIds.length) {
      const nextChord = allChordIds[config.activeChordIds.length];
      await db.config.update(profileId, {
        activeChordIds: [...config.activeChordIds, nextChord],
        currentLevelStartedAtUtc: Date.now()
      });
    }
  };

  const removeLastChord = async () => {
    if (config.activeChordIds.length <= 1) return;
    if (window.confirm("Step back one chord? This will reduce the active chord pool.")) {
      const newActive = config.activeChordIds.slice(0, -1);
      await db.config.update(profileId, {
        activeChordIds: newActive,
        currentLevelStartedAtUtc: Date.now()
      });
    }
  };

  const setTrialsCount = async (count: number) => {
    await db.config.update(profileId, { trialsPerSession: count });
  };

  const resetData = async () => {
    if (window.confirm(`Delete all of ${profile.name}'s practice history and start again from Red? This cannot be undone.`)) {
       await resetProfileData(profileId);
       onExit();
    }
  };

  const restartOnboarding = async () => {
    await setOnboardingCompleted(false);
    onExit();
  };

  const exportData = async () => {
    const [sessions, trials] = await db.transaction('r', db.sessions, db.trials, () => Promise.all([
      db.sessions.where('profileId').equals(profileId).toArray(),
      db.trials.where('profileId').equals(profileId).toArray(),
    ]));
    const data = {
      schema_version: 2,
      exported_at_utc: Date.now(),
      profile,
      config,
      sessions,
      trials,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // Names with no ASCII letters (e.g. 李明) would otherwise all collapse to one filename.
    const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || profile.id.slice(0, 8);
    a.href = url;
    a.download = `eguchi-backup-${slug}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const handleDelete = async (p: Profile) => {
    if (window.confirm(`Delete ${p.name} and all of their practice history? This cannot be undone.`)) {
      // Leave first when deleting the active child, so the dashboard never renders a frame
      // of the sibling's data (App's snapshot flips the active profile as the delete commits).
      if (p.id === profileId) onExit();
      await deleteProfile(p.id);
    }
  };

  const totalTrials = recentTrials?.length || 0;
  const correctTrials = recentTrials?.filter(t => t.firstAnswerCorrect).length || 0;
  const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

  // Days at current level
  const levelStart = config.currentLevelStartedAtUtc || Date.now();
  const daysAtLevel = Math.max(1, Math.floor((Date.now() - levelStart) / (1000 * 60 * 60 * 24)));

  // Advancement requirements evaluation
  const has14Days = daysAtLevel >= 14;
  const hasHighAccuracy = totalTrials >= 100 && accuracy >= 95;

  if (subView === 'guide') {
    return (
      <ParentGuide 
        config={config}
        todaySessionsCount={todaySessionsCount}
        onBack={() => setSubView('dashboard')}
        onStartPractice={onStartPractice}
        initialSection={guideSection}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-y-auto select-none">
      {/* Top Banner with Large Primary Return Button */}
      <div className="bg-white p-4 sticky top-0 z-20 shadow-sm border-b border-slate-200">
        <button 
          onClick={onExit}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl flex items-center justify-center space-x-3 font-bold text-base shadow-md active:scale-[0.99] transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
          <span>Back to Child Practice</span>
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full pb-16">
        
        {/* Prominent Method Guide / How This Works Hero Card */}
        <section className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-xs font-semibold">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Parent Guide</span>
              </div>
              <h2 className="text-xl font-bold">How This Works</h2>
              <p className="text-xs text-blue-200 leading-relaxed max-w-xs">
                Essential reference guide for parents: daily routines, handling mistakes, research facts, and progression criteria.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => openGuideAt('quickstart')}
              className="py-3 px-3 bg-white text-blue-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm active:bg-blue-50 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Quick Start</span>
            </button>
            <button
              onClick={() => openGuideAt('mistakes')}
              className="py-3 px-3 bg-blue-800/80 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 border border-blue-700 transition-colors"
            >
              <span>Mistake Scripts</span>
            </button>
          </div>
        </section>

        {/* Status / Live Metrics Card */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold">Recent Progress</h2>
            </div>
            <button
              onClick={() => openGuideAt('progress')}
              className="text-xs text-blue-600 font-semibold flex items-center space-x-1 hover:underline"
            >
              <span>How progress is measured</span>
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 block mb-0.5">Accuracy</span>
              <strong className="text-xl font-bold text-slate-900">{totalTrials > 0 ? `${accuracy}%` : '—'}</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">first-answer</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 block mb-0.5">Sessions Today</span>
              <strong className="text-xl font-bold text-slate-900">{todaySessionsCount}/4</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">completed</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 block mb-0.5">Days at Level</span>
              <strong className="text-xl font-bold text-slate-900">{daysAtLevel}</strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">min 14 days</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-xs">
            <strong>Note on progress:</strong> High chord accuracy indicates good training progress, but does not prove independent absolute pitch.
          </div>
        </section>

        {/* Curriculum & Advancement Card */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-800">
              <Settings className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold">Curriculum & Level</h2>
            </div>
            <button
              onClick={() => openGuideAt('curriculum')}
              className="text-xs text-blue-600 font-semibold flex items-center space-x-1 hover:underline"
            >
              <span>Why am I waiting?</span>
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active chord swatches */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600 block">
              Active Chords ({config.activeChordIds.length} of {CHORDS.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {config.activeChordIds.map((id) => {
                const chord = CHORDS_MAP.get(id);
                return (
                  <div
                    key={id}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center space-x-1.5 bg-slate-50 shadow-2xs"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: chord?.colorHex }}
                    />
                    <span className="text-xs font-bold text-slate-800">{chord?.displayIdentity}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advancement Checklist */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Advancement Checklist (ALL required):</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">Strict Rule</span>
            </div>
            
            <div className="flex items-start space-x-2">
              {has14Days ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
              <div>
                <span className={has14Days ? 'text-green-800 font-semibold block' : 'text-slate-700 font-semibold block'}>
                  1. Minimum 14 days at this level ({daysAtLevel}/14 days)
                </span>
                <span className="text-[11px] text-slate-500">
                  Allows auditory memory consolidation (~56 sessions / 1,400 sounds).
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              {hasHighAccuracy ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
              <div>
                <span className={hasHighAccuracy ? 'text-green-800 font-semibold block' : 'text-slate-700 font-semibold block'}>
                  2. ≥ 95% accuracy over last 100 trials ({accuracy}%)
                </span>
                <span className="text-[11px] text-slate-500">
                  Evaluates the rolling last 100 individual sounds (approx. 4 sessions / 1 day).
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-700 font-semibold block">
                  3. Explicit parent approval
                </span>
                <span className="text-[11px] text-slate-500">
                  No automatic jump; parent decides when the child is confident.
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            <button
              onClick={addChord}
              disabled={config.activeChordIds.length >= CHORDS.length}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Introduce Next Chord ({CHORDS[config.activeChordIds.length]?.displayIdentity || 'Complete'})
            </button>

            {config.activeChordIds.length > 1 && (
              <button
                onClick={removeLastChord}
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 font-semibold text-xs transition-colors"
              >
                Step back one chord
              </button>
            )}
          </div>
        </section>

        {/* Session Settings & Device Sound Test */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <h2 className="text-base font-bold text-slate-800">Session Configuration & Audio</h2>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Trials per session</span>
              <span className="text-[11px] text-slate-500">Eguchi standard: 20–25 sounds per session</span>
            </div>
            <div className="flex space-x-1.5">
              {[20, 25].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => setTrialsCount(cnt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    config.trialsPerSession === cnt
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100">
            <div>
              <span className="text-xs font-bold text-blue-950 block">Device Audio Test</span>
              <span className="text-[11px] text-blue-700">Verify volume and speaker output</span>
            </div>
            <button
              onClick={async () => {
                setIsPlayingTest(true);
                await audio.init();
                audio.playChord([60, 64, 67]); // C Major (Red)
                setTimeout(() => {
                  audio.speak("Red");
                  setIsPlayingTest(false);
                }, 1200);
              }}
              disabled={isPlayingTest}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm disabled:opacity-50 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{isPlayingTest ? 'Playing...' : 'Play Test Chord'}</span>
            </button>
          </div>
        </section>

        {/* Profiles */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <div className="flex items-center space-x-2 text-slate-800">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold">Profiles</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Each profile has its own chords, history, and progress. Everything above describes <strong>{profile.name}</strong>. Switching here changes who the home screen practices as.
          </p>

          <div className="space-y-2">
            {profiles.map((p) => {
              const isActive = p.id === profileId;
              if (typeof editing === 'object' && editing?.rename === p.id) {
                return (
                  <div key={p.id} className={inlineFormClass}>
                    <ProfileForm
                      tone="light"
                      submitLabel="Save"
                      initialName={p.name}
                      initialColor={p.colorHex}
                      showPrivacyNotice={false}
                      onSubmit={async (name, colorHex) => {
                        await updateProfile(p.id, name, colorHex);
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isActive ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <button
                    onClick={() => { if (!isActive) setActiveProfile(p.id); }}
                    className="flex items-center space-x-2 min-w-0 flex-1 text-left"
                    aria-label={isActive ? `${p.name} (active)` : `Switch to ${p.name}`}
                  >
                    <ProfileDot colorHex={p.colorHex} className={`w-5 h-5 text-white ${isActive ? '' : 'opacity-60'}`}>
                      {isActive && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </ProfileDot>
                    <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-950' : 'text-slate-700'}`}>{p.name}</span>
                    {isActive && <span className="text-[10px] font-semibold text-blue-600 shrink-0">Active</span>}
                  </button>
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => setEditing({ rename: p.id })}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {editing === 'add' ? (
            <div className={inlineFormClass}>
              <ProfileForm
                tone="light"
                submitLabel="Add & switch"
                initialColor={suggestProfileColour(profiles)}
                onSubmit={async (name, colorHex) => {
                  await createProfile(name, colorHex);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            </div>
          ) : (
            <button
              onClick={() => setEditing('add')}
              className={secondaryButtonClass}
            >
              <Plus className="w-4 h-4" />
              <span>Add another profile</span>
            </button>
          )}
        </section>

        {/* Data & System Options */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3">
          <h2 className="text-base font-bold text-slate-800">Data & Guide Access</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {profile.name}'s practice history is stored locally in your browser's private database and never leaves this device. Export regular backups to prevent accidental data loss.
          </p>

          <div className="space-y-2 pt-1">
            <button
              onClick={exportData}
              className={secondaryButtonClass}
            >
              <Download className="w-4 h-4" />
              <span>Export {profile.name}'s Backup (JSON)</span>
            </button>

            <button
              onClick={restartOnboarding}
              className={secondaryButtonClass}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Replay Onboarding Screens</span>
            </button>

            <button
              onClick={resetData}
              className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs transition-colors"
            >
              Reset {profile.name}'s Practice Data
            </button>
          </div>
        </section>

        {/* Legal / Attribution */}
        <div className="pt-4 text-center">
          <p className="text-[10px] text-slate-400">
            Acoustic piano samples from Salamander Grand Piano V3<br/>
            by Alexander Holm, licensed under CC BY 3.0.
          </p>
        </div>

      </div>
    </div>
  );
}
