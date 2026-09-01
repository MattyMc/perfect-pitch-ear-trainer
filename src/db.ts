import Dexie, { Table } from 'dexie';

export interface ChordDefinition {
  id: string;
  order: number;
  notesWithOctave: string;
  inversionDescription: string;
  midiNotes: number[];
  displayIdentity: string;
  colorHex: string;
}

export interface Session {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  endedAt: number | null;
  status: 'active' | 'completed' | 'completed_short' | 'interrupted' | 'discarded';
  endReason: 'target_reached' | 'parent_ended' | 'idle_timeout' | null;
  scoredTrialCount: number;
  plannedTrialCount: number;
  sequence: string[];
}

export interface Trial {
  id: string;
  sessionId: string;
  sequenceIndex: number;
  presentedChordId: string;
  presentedGridIndex?: number;
  replayCount: number;
  firstAnswerChordId: string | null;
  firstAnswerGridIndex?: number;
  firstAnswerCorrect: boolean;
  completedAtUtc: number;
  correctionTapCount: number;
  correctionIncomplete?: boolean;
}

export interface AppConfig {
  id: string; // single row 'config'
  activeChordIds: string[];
  trialsPerSession: number;
  hasCompletedOnboarding?: boolean;
  currentLevelStartedAtUtc?: number;
}

export class EguchiDB extends Dexie {
  sessions!: Table<Session, string>;
  trials!: Table<Trial, string>;
  config!: Table<AppConfig, string>;

  constructor() {
    super('EguchiDB');
    this.version(1).stores({
      sessions: 'id, startedAtUtc, completed',
      trials: 'id, sessionId, presentedChordId, completedAtUtc',
      config: 'id',
    });
    this.version(2).stores({
      sessions: 'id, startedAt, status',
    });
  }
}

export const db = new EguchiDB();

export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

export async function checkAndCloseStaleSessions() {
  const activeSessions = await db.sessions.filter(s => s.status === 'active').toArray();
  const now = Date.now();

  for (const session of activeSessions) {
    if (now - session.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) {
      let status: Session['status'] = 'discarded';
      if (session.scoredTrialCount === 25) status = 'completed';
      else if (session.scoredTrialCount >= 20) status = 'completed_short';
      else if (session.scoredTrialCount > 0) status = 'interrupted';
      
      await db.sessions.update(session.id, {
        status,
        endReason: 'idle_timeout',
        endedAt: session.lastActivityAt,
      });
    }
  }
}

export async function getResumeableSession(): Promise<Session | undefined> {
  const now = Date.now();
  const activeSessions = await db.sessions.filter(s => s.status === 'active').toArray();
  // Sort by last activity, newest first
  activeSessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  
  const latest = activeSessions[0];
  if (latest && now - latest.lastActivityAt < SESSION_IDLE_TIMEOUT_MS) {
    return latest;
  }
  return undefined;
}

export async function endSession(sessionId: string, reason: Session['endReason']) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  
  let status: Session['status'] = 'discarded';
  if (session.scoredTrialCount === 25) status = 'completed';
  else if (session.scoredTrialCount >= 20) status = 'completed_short';
  else if (session.scoredTrialCount > 0) status = 'interrupted';
  
  await db.sessions.update(sessionId, {
    status,
    endReason: reason,
    endedAt: session.lastActivityAt,
  });
}

// Initialize config if empty
db.on('ready', async () => {
  const count = await db.config.count();
  if (count === 0) {
    await db.config.add({
      id: 'config',
      activeChordIds: ['red'], // Start with only Red
      trialsPerSession: 25,
      hasCompletedOnboarding: false,
      currentLevelStartedAtUtc: Date.now(),
    });
  }
});
