// Draws the favicons, the touch icon and the manifest icons in public/ from
// the mark's path in src/components/Logo/Logo.tsx.
//
//   node scripts/build-icons.mjs
//
// Most icons are the bare practice square: the red frame is the icon's edge.
// Two are not, because a platform crops them: iOS rounds the touch icon's
// corners, and Android crops a maskable icon to any shape inside the middle
// 80%. Those two keep a paper ground under the frame.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RED = '#b8323f';
const PAPER = '#efdece';
const INK = '#2b2622';

const logo = readFileSync(new URL('../src/components/Logo/Logo.tsx', import.meta.url), 'utf8');
const HAN_PATH = logo.match(/const HAN_PATH =\s*'([^']+)'/)[1];

// The glyph's path sits in a 70-unit square at 15..85; `inset` is where the
// frame's outer edge sits, so the glyph scales to fill the frame.
const r = (n) => +n.toFixed(2);

function mark({ inset, frame, rx, ground }) {
  const half = frame / 2;
  const edge = inset + half;
  const side = 100 - 2 * edge;
  const scale = (100 - 2 * inset) / 72.2;
  const g0 = inset + frame;
  const g1 = 100 - g0;
  // The guides are clipped to the frame's inside: where its corners are
  // rounder than the diagonals' ends, they would otherwise show past it.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<clipPath id="inside"><rect x="${g0}" y="${g0}" width="${g1 - g0}" height="${g1 - g0}" rx="${Math.max(rx - half, 0)}"/></clipPath>
${ground ? `<rect width="100" height="100" fill="${PAPER}"/>\n` : ''}<rect x="${edge}" y="${edge}" width="${side}" height="${side}" rx="${rx}" fill="${PAPER}" stroke="${RED}" stroke-width="${frame}"/>
<g clip-path="url(#inside)" stroke="${RED}" stroke-opacity="0.75" stroke-width="${r(1.2 * scale)}" stroke-dasharray="${r(2.5 * scale)} ${r(2 * scale)}"><line x1="${g0}" y1="50" x2="${g1}" y2="50"/><line x1="50" y1="${g0}" x2="50" y2="${g1}"/><line x1="${g0}" y1="${g0}" x2="${g1}" y2="${g1}"/><line x1="${g1}" y1="${g0}" x2="${g0}" y2="${g1}"/></g>
<path transform="translate(50 50) scale(${r(scale)}) translate(-50 -50)" fill="${INK}" d="${HAN_PATH}"/>
</svg>
`;
}

const bare = mark({ inset: 0, frame: 4, rx: 8 });
// The frame follows iOS's corner radius (about 22% of the side).
const touch = mark({ inset: 3, frame: 4, rx: 19, ground: true });
// The frame's corners stay inside the maskable safe circle (radius 40).
const maskable = mark({ inset: 21, frame: 3, rx: 4, ground: true });

writeFileSync('public/favicon.svg', bare);

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, file, transparent = true) {
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  writeFileSync(file, await page.locator('svg').screenshot({ omitBackground: transparent }));
}
await png(bare, 128, 'public/favicon.png');
await png(bare, 192, 'public/logo192.png');
await png(bare, 512, 'public/logo512.png');
await png(touch, 180, 'public/apple-touch-icon.png', false);
await png(maskable, 512, 'public/logo-maskable-512.png', false);
const tmp = mkdtempSync(join(tmpdir(), 'hl-ico-'));
for (const s of [16, 24, 32, 64]) await png(bare, s, join(tmp, `${s}.png`));
await browser.close();

execFileSync('python3', [
  '-c',
  `import sys
from PIL import Image
d = sys.argv[1]
Image.open(f'{d}/64.png').save('public/hl.ico', sizes=[(16,16),(24,24),(32,32),(64,64)], append_images=[Image.open(f'{d}/{s}.png') for s in (16,24,32)])`,
  tmp,
]);
