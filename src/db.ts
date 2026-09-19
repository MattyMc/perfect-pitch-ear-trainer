import Dexie, { Table } from 'dexie';
import { newId } from './utils/id';

export interface ChordDefinition {
  id: string;
  order: number;
  notesWithOctave: string;
  inversionDescription: string;
  midiNotes: number[];
  displayIdentity: string;
  colorHex: string;
}

/**
 * Deep, low-chroma jewel tones, two steps darker than the answer cards. A chord's colour *is*
 * its identity to the child, so profile colours are kept in a visibly different family: the
 * cards are bright paint, these are UI ink, matching the app's slate and blue chrome. The
 * hues still span the wheel so eight profiles stay distinct, and each takes a white tick at
 * 4.5:1 or better. Role and size are the other half of the rule: only ever a small dot
 * beside a name, never card-sized and never spoken. Chosen on the "Profile Colour Palette"
 * design canvas, where the alternatives are shown against the chord colours.
 */
export const PROFILE_COLOURS = [
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#4f46e5', name: 'Indigo' },
  { hex: '#be123c', name: 'Crimson' },
  { hex: '#b45309', name: 'Amber' },
  { hex: '#047857', name: 'Forest' },
  { hex: '#0369a1', name: 'Ocean' },
  { hex: '#86198f', name: 'Plum' },
  { hex: '#475569', name: 'Slate' },
] as const;

export type ProfileColour = (typeof PROFILE_COLOURS)[number]['hex'];

/** The first palette colour no existing profile uses, so siblings get distinct dots by default. */
export function suggestProfileColour(existing: ReadonlyArray<Pick<Profile, 'colorHex'>>): ProfileColour {
  const taken = new Set<string>(existing.map(p => p.colorHex));
  return (PROFILE_COLOURS.find(c => !taken.has(c.hex)) ?? PROFILE_COLOURS[0]).hex;
}

/**
 * A learner. Just a display name and a colour — no credentials, no identity beyond this
 * browser. Every session, trial, and config row is scoped to exactly one profile.
 */
export interface Profile {
  id: string;
  name: string;
  colorHex: ProfileColour;
  createdAtUtc: number;
}

/**
 * Device-level state that is not about any one profile. A single row with id 'app' that
 * always exists: `populate` creates it on a fresh database and the v3 upgrade on an old one.
 */
export interface AppMeta {
  id: string; // always 'app'
  activeProfileId: string | null;
  /** Onboarding is parent education, so it is completed once per device, not per child. */
  hasCompletedOnboarding: boolean;
}

export interface Session {
  id: string;
  profileId: string;
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
  profileId: string;
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
  id: string; // the owning profile's id — one config row per profile
  activeChordIds: string[];
  trialsPerSession: number;
  currentLevelStartedAtUtc?: number;
}

export const META_ID = 'app';
export const PROFILE_NAME_MAX_LENGTH = 24;
export const DEFAULT_TRIALS_PER_SESSION = 25;

/** Name given to the profile that an install from before profiles existed is migrated into. */
export const LEGACY_PROFILE_NAME = 'My child';

const INITIAL_META: AppMeta = { id: META_ID, activeProfileId: null, hasCompletedOnboarding: false };

export function defaultConfig(profileId: string): AppConfig {
  return {
    id: profileId,
    activeChordIds: ['red'], // Start with only Red
    trialsPerSession: DEFAULT_TRIALS_PER_SESSION,
    currentLevelStartedAtUtc: Date.now(),
  };
}

export class EguchiDB extends Dexie {
  profiles!: Table<Profile, string>;
  meta!: Table<AppMeta, string>;
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
    // v3: profiles. Sessions and trials gain a profileId; config is keyed by profile id
    // instead of the literal 'config'; the meta row appears. The upgrade only ever ran on
    // this developer's machine (nobody else had pre-profile data) and can be deleted along
    // with v1 and v2 once that database has been through it.
    this.version(3)
      .stores({
        profiles: 'id, createdAtUtc',
        meta: 'id',
        config: 'id',
        sessions: 'id, startedAt, status, profileId, [profileId+startedAt], [profileId+status]',
        trials: 'id, sessionId, presentedChordId, completedAtUtc, profileId, [profileId+completedAtUtc]',
      })
      .upgrade(async (tx) => {
        // Pre-profile config carried the onboarding flag; it now lives on the meta row.
        type LegacyConfig = Partial<AppConfig> & { hasCompletedOnboarding?: boolean };
        const legacyConfig = (await tx.table('config').get('config')) as LegacyConfig | undefined;
        if (legacyConfig) await tx.table('config').delete('config');

        // Keep the install if there is any evidence it was used. The onboarding flag alone is
        // not enough: the old "Replay Onboarding" button cleared it on installs with progress.
        const chordCount = Array.isArray(legacyConfig?.activeChordIds) ? legacyConfig.activeChordIds.length : 0;
        const used =
          legacyConfig?.hasCompletedOnboarding === true ||
          chordCount > 1 ||
          (await tx.table('sessions').count()) > 0;
        if (!legacyConfig || !used) {
          await tx.table('meta').put(INITIAL_META);
          return;
        }

        const profileId = newId();
        const { hasCompletedOnboarding: _dropped, ...legacyRest } = legacyConfig;
        await tx.table('profiles').add({
          id: profileId,
          name: LEGACY_PROFILE_NAME,
          colorHex: PROFILE_COLOURS[0].hex,
          createdAtUtc: Date.now(),
        } satisfies Profile);
        await tx.table('config').add({ ...defaultConfig(profileId), ...legacyRest, id: profileId } satisfies AppConfig);
        await tx.table('sessions').toCollection().modify({ profileId });
        await tx.table('trials').toCollection().modify({ profileId });
        await tx.table('meta').put({ id: META_ID, activeProfileId: profileId, hasCompletedOnboarding: legacyConfig.hasCompletedOnboarding === true } satisfies AppMeta);
      });

    // A brand-new database never runs an upgrade, so the meta row is seeded here instead.
    this.on('populate', (tx) => {
      tx.table('meta').add(INITIAL_META);
    });
  }
}

export const db = new EguchiDB();

export const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export async function setOnboardingCompleted(completed: boolean) {
  await db.meta.update(META_ID, { hasCompletedOnboarding: completed });
}

export async function setActiveProfile(profileId: string | null) {
  await db.meta.update(META_ID, { activeProfileId: profileId });
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export function normaliseProfileName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, PROFILE_NAME_MAX_LENGTH);
}

/** Creates a profile with a fresh config row and makes it the active one. */
export async function createProfile(rawName: string, colorHex: ProfileColour): Promise<Profile> {
  const name = normaliseProfileName(rawName);
  if (!name) throw new Error('Profile name is required');

  const profile: Profile = { id: newId(), name, colorHex, createdAtUtc: Date.now() };
  await db.transaction('rw', db.profiles, db.config, db.meta, async () => {
    await Promise.all([
      db.profiles.add(profile),
      db.config.add(defaultConfig(profile.id)),
      db.meta.update(META_ID, { activeProfileId: profile.id }),
    ]);
  });
  return profile;
}

export async function updateProfile(profileId: string, rawName: string, colorHex: ProfileColour) {
  const name = normaliseProfileName(rawName);
  if (!name) return;
  await db.profiles.update(profileId, { name, colorHex });
}

/** Everything scoped to a profile other than the profile and config rows themselves. */
async function deleteProfileHistory(profileId: string) {
  await Promise.all([
    db.trials.where('profileId').equals(profileId).delete(),
    db.sessions.where('profileId').equals(profileId).delete(),
  ]);
}

/** Deletes the profile and every record scoped to it. Moves the active pointer if needed. */
export async function deleteProfile(profileId: string) {
  await db.transaction('rw', db.profiles, db.config, db.sessions, db.trials, db.meta, async () => {
    await Promise.all([
      deleteProfileHistory(profileId),
      db.config.delete(profileId),
      db.profiles.delete(profileId),
    ]);

    const meta = await db.meta.get(META_ID);
    if (meta?.activeProfileId === profileId) {
      const remaining = await db.profiles.orderBy('createdAtUtc').first();
      await db.meta.update(META_ID, { activeProfileId: remaining?.id ?? null });
    }
  });
}

/** Wipes a profile's history and returns its config to the seed. The profile itself survives. */
export async function resetProfileData(profileId: string) {
  await db.transaction('rw', db.config, db.sessions, db.trials, async () => {
    await Promise.all([
      deleteProfileHistory(profileId),
      db.config.put(defaultConfig(profileId)),
    ]);
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * How a session is classified when it closes early or times out. Reaching the planned count
 * is 'completed'; 20 or more sounds still qualifies as a session ('completed_short').
 */
function closedStatusFor(session: Pick<Session, 'scoredTrialCount' | 'plannedTrialCount'>): Session['status'] {
  if (session.scoredTrialCount >= session.plannedTrialCount) return 'completed';
  if (session.scoredTrialCount >= 20) return 'completed_short';
  if (session.scoredTrialCount > 0) return 'interrupted';
  return 'discarded';
}

/**
 * Closes every profile's stale sessions, not just the current one's, so a child who
 * abandoned a session weeks ago is not left with an 'active' row until they next practice.
 * One transaction over the status index; usually zero or one row.
 */
export async function checkAndCloseStaleSessions() {
  const now = Date.now();
  await db.sessions
    .where('status')
    .equals('active')
    .and((session) => now - session.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS)
    .modify((session) => {
      session.status = closedStatusFor(session);
      session.endReason = 'idle_timeout';
      session.endedAt = session.lastActivityAt;
    });
}

export async function getResumeableSession(profileId: string): Promise<Session | undefined> {
  const now = Date.now();
  const activeSessions = await db.sessions.where('[profileId+status]').equals([profileId, 'active']).toArray();
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

  await db.sessions.update(sessionId, {
    status: closedStatusFor(session),
    endReason: reason,
    endedAt: session.lastActivityAt,
  });
}

/**
 * Records one trial and advances its session in a single transaction. Resolves false, and
 * writes nothing, if the session row no longer exists — the parent reset or deleted this
 * profile from another tab — so the caller can leave instead of writing orphan rows that
 * would still count toward the profile's accuracy.
 */
export async function recordTrial(trial: Trial, sessionPatch: Partial<Session>): Promise<boolean> {
  return db.transaction('rw', db.sessions, db.trials, async () => {
    // An explicit read: update()'s count is 0 for a no-op patch too, not only a missing row.
    if (!(await db.sessions.get(trial.sessionId))) return false;
    await Promise.all([
      db.sessions.update(trial.sessionId, sessionPatch),
      db.trials.put(trial),
    ]);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Per-profile queries shared by more than one screen
// ---------------------------------------------------------------------------

/** Completed sessions for one profile since local midnight — the "N of 4 today" count. */
export function completedSessionsTodayQuery(profileId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return db.sessions
    .where('[profileId+startedAt]')
    .between([profileId, startOfToday.getTime()], [profileId, Dexie.maxKey], true, true)
    .filter(s => s.status === 'completed' || s.status === 'completed_short')
    .toArray();
}

/** The newest trials for one profile, newest first — the dashboard's accuracy window. */
export function recentTrialsQuery(profileId: string, limit = 100) {
  return db.trials
    .where('[profileId+completedAtUtc]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}
