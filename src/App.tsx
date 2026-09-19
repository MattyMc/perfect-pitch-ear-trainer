/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, META_ID, suggestProfileColour, AppConfig, Profile } from './db';
import ChildHome from './components/ChildHome';
import Practice from './components/Practice';
import IntroMode from './components/IntroMode';
import ParentGate from './components/ParentGate';
import ParentDashboard from './components/ParentDashboard';
import FirstRunOnboarding from './components/FirstRunOnboarding';
import ProfileCreateScreen from './components/ProfileCreateScreen';
import ProfileSwitcher from './components/ProfileSwitcher';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';

const Loading = () => (
  <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">Loading...</div>
);

/**
 * The practice view remembers which profile it was started for. If the active profile changes
 * underneath it (a switch from another tab), it renders the home screen instead of starting a
 * session for a learner nobody chose. A `key` remount would do exactly that.
 */
type View = 'home' | 'parent' | 'profiles' | { practice: string };

export default function App() {
  const [view, setView] = useState<View>('home');

  // One query, one snapshot. Profiles, the meta row, and the active profile's config are
  // read inside a single read transaction so they can never disagree (a createProfile or
  // deleteProfile committing between two separate reads would pair a pointer with a missing
  // profile, or a profile with a missing config). useLiveQuery hands back the previous whole
  // snapshot until the next is ready, and Dexie re-runs it when any of the three tables
  // changes. Splitting this into separate queries produced a transitional frame on every
  // profile switch, which unmounted the tree (re-locking the parent gate) and briefly paired
  // one profile with another's config.
  //
  // Invariants the writes guarantee (meta seeded on populate/upgrade, config written with its
  // profile in one transaction) are asserted here by throwing. A failed database open rejects
  // this querier too. Either way useLiveQuery rethrows during render and AppErrorBoundary in
  // main.tsx shows the error screen, so this component holds no error handling of its own.
  const snapshot = useLiveQuery(() =>
    db.transaction('r', db.profiles, db.meta, db.config, async () => {
      const [profiles, meta] = await Promise.all([
        db.profiles.orderBy('createdAtUtc').toArray(),
        db.meta.get(META_ID),
      ]);
      if (!meta) throw new Error('The app settings row is missing from the local database.');
      const profile = profiles.find(p => p.id === meta.activeProfileId);
      let active: { profile: Profile; config: AppConfig } | null = null;
      if (profile) {
        const config = await db.config.get(profile.id);
        if (!config) throw new Error(`Profile ${profile.id} has no settings row in the local database.`);
        active = { profile, config };
      }
      return { profiles, active, hasCompletedOnboarding: meta.hasCompletedOnboarding };
    })
  );

  let screen: ReactNode;

  if (!snapshot) {
    screen = <Loading />;
  } else if (snapshot.profiles.length === 0) {
    // Gate 1: nothing exists yet. Create the first profile before anything else.
    screen = <ProfileCreateScreen initialColor={suggestProfileColour([])} onCreated={() => setView('home')} />;
  } else if (!snapshot.active || view === 'profiles') {
    // Gate 2: profiles exist but none is selected (e.g. the active one was deleted).
    screen = (
      <ProfileSwitcher
        profiles={snapshot.profiles}
        activeProfileId={snapshot.active?.profile.id ?? null}
        onDone={() => setView('home')}
      />
    );
  } else if (!snapshot.hasCompletedOnboarding) {
    // Gate 3: first-run parent onboarding, once per device. Checked after the profile gates
    // so the copy can use the child's name, and never re-triggered by adding a child.
    const { profile } = snapshot.active;
    screen = (
      <FirstRunOnboarding
        profileName={profile.name}
        onComplete={(action) => setView(action === 'practice' ? { practice: profile.id } : 'parent')}
      />
    );
  } else {
    const { profiles, active: { profile, config } } = snapshot;
    const startPractice = () => setView({ practice: profile.id });
    if (typeof view === 'object' && view.practice === profile.id) {
      screen = config.activeChordIds.length === 1 ? (
        <IntroMode
          profileId={profile.id}
          chordId={config.activeChordIds[0]}
          onExit={() => setView('home')}
        />
      ) : (
        <Practice
          profileId={profile.id}
          activeChordIds={config.activeChordIds}
          trialsPerSession={config.trialsPerSession}
          onExit={() => setView('home')}
        />
      );
    } else if (view === 'parent') {
      screen = (
        <ParentGate onCancel={() => setView('home')}>
          <ParentDashboard
            profile={profile}
            config={config}
            profiles={profiles}
            onExit={() => setView('home')}
            onStartPractice={startPractice}
          />
        </ParentGate>
      );
    } else {
      screen = (
        <ChildHome
          profile={profile}
          onStart={startPractice}
          onParent={() => setView('parent')}
          onSwitchProfile={() => setView('profiles')}
        />
      );
    }
  }

  // Every screen paints its own background, so the shell only sizes and clips.
  return (
    <div className="w-full h-[100dvh] bg-slate-900 overflow-hidden font-sans">
      {screen}
      <RotateDeviceOverlay />
    </div>
  );
}
