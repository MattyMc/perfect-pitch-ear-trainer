# Matt McInnis' Perfect Pitch Ear Training for Kids

A parent-supervised ear trainer for young children, after the Eguchi method: the app plays a fixed piano chord and the child taps the colour that goes with it. Chords are never named as notes to the child. The colour *is* the identity. Training is deliberately slow, weeks per chord, and every profile's progress stays on the device.

**Live:** https://mattymc.github.io/perfect-pitch-ear-trainer/

## What it does

- Named profiles, each with its own chords, history, and colour, switchable from the home screen.
- A scored practice loop with a neutral correction on every mistake.
- A parent area behind a press-and-hold gate: progress, curriculum, profiles, backup export.
- No account, no sign-in, no sync. Nothing leaves the browser it runs in.

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
