# Data, privacy, and offline status

Source: `src/db.ts`, `src/components/ParentDashboard.tsx`, `public/manifest.json`, `index.html`, `package.json`.

## Storage

All records live in the browser's IndexedDB in a Dexie database named `EguchiDB`. Components read it with `useLiveQuery` from `dexie-react-hooks` and write to it directly. There is no other state container.

### Tables and interfaces

```ts
interface Profile {
  id: string;
  name: string;                      // display name only; nothing else identifies a learner
  colorHex: ProfileColour;           // a union of PROFILE_COLOURS hexes; a dot beside the name, never a card
  createdAtUtc: number;
}

interface AppMeta {
  id: string;                        // always 'app'; a single row
  activeProfileId: string | null;    // which profile the home screen practices as
  hasCompletedOnboarding: boolean;   // once per device: onboarding is parent education
}

interface AppConfig {
  id: string;                        // the owning profile's id; one row per profile
  activeChordIds: string[];          // prefix of CHORDS, see curriculum.md
  trialsPerSession: number;          // 20 or 25
  currentLevelStartedAtUtc?: number; // reset on every add or remove of a chord
}

interface Session {
  id: string;
  profileId: string;
  startedAt: number;
  lastActivityAt: number;
  endedAt: number | null;            // set to lastActivityAt on close
  status: 'active' | 'completed' | 'completed_short' | 'interrupted' | 'discarded';
  endReason: 'target_reached' | 'parent_ended' | 'idle_timeout' | null;
  scoredTrialCount: number;
  plannedTrialCount: number;
  sequence: string[];                // chord ids in presentation order
}

interface Trial {
  id: string;
  profileId: string;
  sessionId: string;
  sequenceIndex: number;
  presentedChordId: string;
  presentedGridIndex?: number;
  replayCount: number;
  firstAnswerChordId: string | null;
  firstAnswerGridIndex?: number;
  firstAnswerCorrect: boolean;       // the one metric everything derives from
  completedAtUtc: number;
  correctionTapCount: number;        // always 0 in practice, see known-issues
  correctionIncomplete?: boolean;    // true between a wrong answer and the corrective tap
}
```

Not stored: any response-time field, any audio/curriculum/app version stamp, any per-level marker on trials. The current level can only be inferred by comparing `completedAtUtc` with `currentLevelStartedAtUtc`, and only for the current level.

### Schema versions

- **v1** declared `sessions: 'id, startedAtUtc, completed'` and `trials: 'id, sessionId, presentedChordId, completedAtUtc'`, `config: 'id'`. The session indexes did not match the interface.
- **v2** corrects sessions to `'id, startedAt, status'`.

- **v3** (19 September 2026) adds `profiles: 'id, createdAtUtc'` and `meta: 'id'`, and extends the others to `sessions: 'id, startedAt, status, profileId, [profileId+startedAt], [profileId+status]'` and `trials: 'id, sessionId, presentedChordId, completedAtUtc, profileId, [profileId+completedAtUtc]'`. Its `upgrade()` is the first real migration: if the pre-profile install has any history (a session, a trial, completed onboarding, or more than one chord) it creates one profile named "My child" (`LEGACY_PROFILE_NAME`), re-keys the `'config'` row to that profile's id (moving its `hasCompletedOnboarding` to `meta`), stamps every session and trial with `profileId`, and points `meta.activeProfileId` at it. The condition is any evidence of use: onboarding completed, more than one chord, or any session row (the flag alone is not enough, since the old "Replay Onboarding" button cleared it on installs with progress). Any other install gets an empty meta row. Only the developer's own machine ever held pre-v3 data. An install with an untouched seed is dropped instead, so the first-run flow creates the profile with a real name.

Per-profile queries use the compound indexes. Any schema change requires a new `this.version(n).stores({...})` block.

### Seed

There is no `db.on('ready')` seed. `createProfile(name)` writes the profile, its config from `defaultConfig(profileId)`, and the active pointer in one transaction:

```ts
{ id: profileId, activeChordIds: ['red'], trialsPerSession: 25, currentLevelStartedAtUtc: Date.now() }
```

The `meta` row always exists: Dexie's `populate` hook seeds it on a fresh database and the v3 upgrade writes it on an old one. Writers therefore use a plain field-level `db.meta.update()`, so setting the active profile never touches the onboarding flag and vice versa. The App snapshot throws if the row is ever missing, which lands on the error screen rather than a blank page.

`resetProfileData` deletes that profile's sessions and trials and re-puts the same seed. `deleteProfile` removes the profile and everything scoped to it, and moves the active pointer to the oldest remaining profile (or null, which sends the app to the switcher).

### Ids

`src/utils/id.ts newId()` wraps `crypto.randomUUID()` with a fallback because that API is absent outside secure contexts, which includes a phone hitting the dev server over LAN HTTP.

## Export

"Export <name>'s Backup (JSON)" on the dashboard downloads the **active profile only**, as `eguchi-backup-<name-slug>-YYYY-MM-DD.json`:

```json
{ "schema_version": 2, "exported_at_utc": "...", "profile": {...}, "config": {...}, "sessions": [...], "trials": [...] }
```

Other profiles need their own export after switching to them.

There is **no import**, so the backup cannot be restored through the app, and **no CSV** export. Both were required by the original spec (D-031). Anyone restoring today would need DevTools or a script against IndexedDB.

## Privacy

Checked on 9 September 2026 by grepping `src/`, `index.html`, and `public/`:

- No `fetch`, `XMLHttpRequest`, `sendBeacon`, or WebSocket. The only network traffic is same-origin: the app bundle and the seven piano samples.
- No `localStorage`, `sessionStorage`, or cookies. The active-profile pointer lives in the `meta` table, not `localStorage`.
- A profile is a display name in IndexedDB and nothing else. The profile creation screen (`PrivacyNotice` in `ProfileForm.tsx`) tells the parent that there is no account or sync, that everything stays in this browser, and that clearing site data erases it. Keep that text truthful against this section.
- No analytics, ads, or third-party scripts.
- No microphone or speech recognition; the Web Speech API is used for **output** only.
- The only outbound links are three research citations in the parent guide, opened with `rel="noreferrer"`.

Hygiene caveat: `@google/genai`, `express`, `dotenv`, `idb`, and `motion` are declared in `package.json`, and `metadata.json` declares a server-side Gemini capability, but none is imported anywhere. They are AI Studio leftovers, not signals about behaviour. Removing them would make the privacy story easier to audit.

## Offline

**The app does not work offline.** There is no service worker, no Workbox, no `caches.open`, no PWA plugin, and `dist/` contains no worker. `public/manifest.json` sets `display: standalone` and `orientation: portrait-primary`, so it installs to the home screen, but every launch fetches the bundle and the first gesture fetches about 483 KB of samples. The spec's Cache Storage decision (D-030) and the rule "do not start practice unless audio is available offline" describe infrastructure that does not exist.

## Installed versions

From `package-lock.json` on 9 September 2026: react 19.3.0, dexie 4.4.5, dexie-react-hooks 4.4.0, tone 15.1.22, vite 6.4.3, tailwindcss 4.3.3, lucide-react 0.546.0, typescript 5.8.3.
