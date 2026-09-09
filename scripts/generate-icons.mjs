/**
 * Generates public/icon-192.png and public/icon-512.png.
 *
 * The mark ("Colour Keys"): four full-bleed piano keys in the first four chord
 * colours, with three short dark keys over the boundaries. Full-bleed on purpose —
 * no margin means every element is as large as the tile allows, which is what makes
 * it survive at favicon sizes. The short keys are what keep it a piano rather than
 * a colour swatch.
 *
 * Geometry is authored in a 512-unit square and scaled to each output size, so the
 * thinnest element (an 80u dark key) is 5.0px at 32px and 2.5px at 16px.
 *
 * Run: node scripts/generate-icons.mjs   (needs Node 20+, no dependencies)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public');
const SIZES = [192, 512];
const SS = 4; // supersampling factor per axis, for antialiasing

// Chord colours, curriculum order, from src/chords.ts
const RED = '#ef4444', YELLOW = '#fde047', BLUE = '#3b82f6';
const DARK = '#171717'; // the "black" chord colour, used for the short keys

// Three bands, not four. A green fourth band was tried and removed: blue and green
// are only 1.61:1 apart in relative luminance, and below the short keys nothing
// separates them, so they fused into one shape at tab size. No other chord colour
// improves on that against blue (orange 1.31:1, pink 1.39:1, purple 1.08:1), so the
// band had to go rather than change colour. The remaining seams are red|yellow at
// 2.85:1 and yellow|blue at 2.79:1, and dropping the fourth band widened the
// survivors from 128 to 171 units.
const BANDS = [
  { x0: 0, x1: 171, hex: RED },
  { x0: 171, x1: 341, hex: YELLOW },
  { x0: 341, x1: 512, hex: BLUE },
];

// y starts above the canvas so the top corners are cropped and the keys sit flush
// with the top edge, as they do on a real keyboard. Two short keys over three
// coloured ones is a real black-key group, the way three sit over four.
//
// 112u wide, centred on the band boundaries at 171 and 341. That leaves a 58u strip
// of yellow between them — 1.81px at favicon size, which sounds alarming but holds:
// yellow against #171717 is 13.6:1, where the seam that actually failed in testing
// (blue against green) was 1.61:1. Contrast decides whether a thin element survives,
// not width alone. Going wider than this starts eating the yellow for real.
const SHORT_KEYS = [115, 285].map((x) => ({ x, y: -20, w: 112, h: 320, r: 16 }));

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

function inRoundedRect(px, py, { x, y, w, h, r }) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Colour at a point in the 512-unit design space. Later shapes win. */
function colourAt(u, v) {
  let c = BANDS[BANDS.length - 1].hex;
  for (const b of BANDS) {
    if (u >= b.x0 && u < b.x1) { c = b.hex; break; }
  }
  for (const k of SHORT_KEYS) {
    if (inRoundedRect(u, v, k)) { c = DARK; break; }
  }
  return rgb(c);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const step = 512 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) * step;
          const v = (y + (sy + 0.5) / SS) * step;
          const c = colourAt(u, v);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, i = (y * size + x) * 4;
      px[i] = Math.round(r / n);
      px[i + 1] = Math.round(g / n);
      px[i + 2] = Math.round(b / n);
      px[i + 3] = 255; // fully opaque — iOS composites transparency onto black
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, px) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type 0 (None)
    px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  const png = encodePng(size, render(size));
  writeFileSync(file, png);
  console.log(`wrote ${file} — ${size}x${size}, ${png.length} bytes`);
}
