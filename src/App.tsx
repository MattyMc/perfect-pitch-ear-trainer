/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import ChildHome from './components/ChildHome';
import Practice from './components/Practice';
import IntroMode from './components/IntroMode';
import ParentGate from './components/ParentGate';
import ParentDashboard from './components/ParentDashboard';
import FirstRunOnboarding from './components/FirstRunOnboarding';
import RotateDeviceOverlay from './components/RotateDeviceOverlay';

export default function App() {
  const [view, setView] = useState<'home' | 'practice' | 'parent'>('home');
  const config = useLiveQuery(() => db.config.get('config'));

  if (!config) {
    return <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">Loading...</div>;
  }

  // First-run experience if not completed
  if (config.hasCompletedOnboarding === false) {
    return (
      <div className="w-full h-[100dvh] bg-slate-900 overflow-hidden font-sans">
        <FirstRunOnboarding
          onComplete={(action) => {
            if (action === 'practice') {
              setView('practice');
            } else {
              setView('parent');
            }
          }}
        />
        <RotateDeviceOverlay />
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] bg-slate-50 overflow-hidden font-sans">
      {view === 'home' && (
        <ChildHome 
          onStart={() => setView('practice')} 
          onParent={() => setView('parent')} 
        />
      )}
      
      {view === 'practice' && (
        config.activeChordIds.length === 1 ? (
          <IntroMode 
            chordId={config.activeChordIds[0]}
            onExit={() => setView('home')} 
          />
        ) : (
          <Practice 
            activeChordIds={config.activeChordIds}
            trialsPerSession={config.trialsPerSession}
            onExit={() => setView('home')} 
          />
        )
      )}
      
      {view === 'parent' && (
        <ParentGate onCancel={() => setView('home')}>
          <ParentDashboard 
            onExit={() => setView('home')} 
            onStartPractice={() => setView('practice')}
          />
        </ParentGate>
      )}
      
      <RotateDeviceOverlay />
    </div>
  );
}
