# Matt McInnis' Perfect Pitch Ear Training for Kids

A parent-supervised ear trainer for young children, after the Eguchi method: the app plays a fixed piano chord and the child taps the colour that goes with it. Chords are never named as notes to the child. The colour *is* the identity. Training is deliberately slow, weeks per chord, and every profile's progress stays on the device.

**Live:** https://mattymc.github.io/perfect-pitch-ear-trainer/

## Privacy: zero data collected

This app collects nothing. There is no account, no sign-in, no sync, no analytics, no advertising, no crash reporting, and no server of any kind behind it. The only network traffic is the page itself and seven piano samples, fetched from the same GitHub Pages site that serves the app.

Everything a family enters (a child's name, a colour, every practice session) is stored in the browser's own local database on that device and never leaves it. The author cannot see it, and neither can anyone else. Backups are a file you download yourself. Clearing the browser's site data erases everything, which is also the only way it is ever deleted.

These claims are checked against the source, not just asserted: see the Privacy section of `docs/data-and-privacy.md`, which is re-verified by grepping the code for network and storage APIs. The source is open under the MIT licence, so anyone can confirm them.

## What it does

- Named profiles, each with its own chords, history, and colour, switchable from the home screen.
- A scored practice loop with a neutral correction on every mistake.
- A parent area behind a press-and-hold gate: progress, curriculum, profiles, backup export.

## Running it

```bash
nvm use       # Node 22.12+
npm install
npm run dev   # http://localhost:3001/perfect-pitch-ear-trainer/
```

`npm run lint` is the only check (a TypeScript type-check). `npm run build` produces `dist/`; pushing to `main` deploys it to GitHub Pages.

## Documentation

`docs/README.md` covers the method, the curriculum, and every product decision with its implementation status. `CLAUDE.md` covers the toolchain and architecture.

## Licence and credits

MIT, see `LICENSE`. Acoustic piano samples from Salamander Grand Piano V3 by Alexander Holm, licensed under CC BY 3.0. Other third-party notices are in `docs/THIRD_PARTY_NOTICES.md`.

Made by Matt McInnis.
