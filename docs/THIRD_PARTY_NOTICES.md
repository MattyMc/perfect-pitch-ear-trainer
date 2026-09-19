# Third-party notices

Third-party components and assets shipped with or used to build the application. This file does not license the application's own source, design, or content. Verified against the repository on 9 September 2026.

## Salamander Grand Piano samples

**Work:** Salamander Grand Piano (Yamaha C5), by Alexander Holm.
**Version:** the V3 release. The README distributed with these files is titled "Salamander Grand Piano V2" but carries the V3 changelog; the in-app attribution says V3.
**Obtained from:** <https://github.com/Tonejs/audio/tree/master/salamander> (the Tone.js audio repository), MP3 encoding.
**Licence:** Creative Commons Attribution 3.0 Unported (CC BY 3.0), <https://creativecommons.org/licenses/by/3.0/legalcode>.

**Files shipped:** `public/audio/piano/A3.mp3`, `C4.mp3`, `Ds4.mp3`, `Fs4.mp3`, `A4.mp3`, `C5.mp3`, `Ds5.mp3`. Seven of the collection's files, about 483 KB in total.

**Transformations:** none at rest. The seven files are byte-identical to the Tonejs/audio copies (128 kbps, 44.1 kHz, joint stereo, LAME 3.99.5, 13 to 16 s each). At playback the application triggers about 1.65 s of each sample and repitches by up to one semitone using `Tone.Sampler`.

**Attribution in the product:** the parent dashboard footer reads "Acoustic piano samples from Salamander Grand Piano V3 by Alexander Holm, licensed under CC BY 3.0." No endorsement by the author is implied. The samples remain available under CC BY 3.0; all other application materials are governed by their own terms.

## Tone.js

**Package:** `tone` 15.1.22
**Source:** <https://github.com/Tonejs/Tone.js>
**Licence:** MIT
**Copyright:** Copyright (c) 2014-2020 Yotam Mann (as stated in the installed `LICENSE.md`)

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Other runtime libraries bundled into the shipped app

Versions and licence fields from the installed packages.

| Package | Version | Licence | Source |
|---|---|---|---|
| react, react-dom | 19.3.0 | MIT | <https://github.com/facebook/react> |
| dexie | 4.4.5 | Apache-2.0 | <https://github.com/dexie/Dexie.js> |
| dexie-react-hooks | 4.4.0 | Apache-2.0 | <https://github.com/dexie/Dexie.js> |
| lucide-react | 0.546.0 | ISC | <https://github.com/lucide-icons/lucide> |
| tailwindcss (generated CSS only) | 4.3.3 | MIT | <https://github.com/tailwindlabs/tailwindcss> |

All permit redistribution with the notice retained. Build-time tools (Vite, TypeScript, the React plugin) are not shipped.

## Other shipped assets

- **App icons** (`public/icon-192.png`, `public/icon-512.png`) are generated from original geometry by `scripts/generate-icons.mjs`. No third-party material.
- **Speech** uses the platform's Web Speech API voices at runtime. No voice recordings are shipped.
- **Fonts:** the system font stack. No web fonts are shipped.

## Declared but unused

`@google/genai`, `express`, `dotenv`, `idb`, and `motion` appear in `package.json` but are not imported and are not bundled. They carry no shipping obligation; they should be removed.
