/**
 * Write a page that draws the component breakdown of some characters, for a
 * review by eye. Each row is one character. Each picture is one part that
 * splits, with its own parts in colors, and the names of these parts below.
 *
 * The page reads the breakdown files that `npm run build:dict` wrote to
 * web-client/public/breakdowns/. The browser downloads the stroke outlines of
 * Hanzi Writer from the CDN, so the page needs a network.
 *
 * Usage:
 *   node review-breakdowns.js <characters> [output file]
 *
 * Example:
 *   node review-breakdowns.js 聯難續里 review.html
 */

const fs = require('fs');
const path = require('path');
const { breakdownFileName } = require('./componentBreakdown');

const BREAKDOWNS_DIR = path.join(__dirname, '..', 'web-client', 'public', 'breakdowns');

/** The version of the stroke data that the app loads: see charDataLoader.ts. */
const STROKE_DATA_URL = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/';

const PAGE = (files) => `<!doctype html>
<meta charset="utf-8">
<title>Component breakdown review</title>
<style>
  body { font: 13px sans-serif; margin: 8px; }
  .row { display: flex; flex-wrap: wrap; align-items: flex-start; border-bottom: 1px solid #999; }
  .top { font-size: 30px; width: 48px; text-align: center; }
  .part { width: 124px; margin: 2px 4px; }
  .names { line-height: 1.2; word-break: break-all; }
</style>
<div id="rows"></div>
<script>
const FILES = ${JSON.stringify(files)};
const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080', '#f032e6', '#9a6324'];
const colorOf = (k) => COLORS[k % COLORS.length];
const nameOf = (part) => (part.c ?? (part.s.length === 1 ? '·' : '？')) + (part.s.length > 1 ? part.s.length : '');

/** One picture: the strokes of \`part\` in black, and the strokes of its parts in colors. */
function picture(strokes, part) {
  const color = new Map();
  part.p.forEach((kid, k) => kid.s.forEach((i) => color.set(i, colorOf(k))));
  const own = new Set(part.s);
  const paths = strokes
    .map((d, i) => '<path d="' + d + '" fill="' + (color.get(i) ?? (own.has(i) ? '#000' : '#ddd')) + '"/>')
    .join('');
  const names = part.p
    .map((kid, k) => '<span style="color:' + colorOf(k) + '">' + nameOf(kid) + '</span>')
    .join(' ');
  return '<div class="part"><svg viewBox="0 0 1024 1024" width="120" height="120">' +
    '<g transform="translate(0, 900) scale(1, -1)">' + paths + '</g></svg>' +
    '<div class="names"><b>' + (part.c ?? '？') + '</b> ' + names + '</div></div>';
}

async function row(file) {
  const response = await fetch('${STROKE_DATA_URL}' + file.c + '.json');
  const { strokes } = await response.json();
  const pictures = [];
  // A split into single strokes has no picture, except for the top character.
  const queue = [{ c: file.c, s: strokes.map((_, i) => i), p: file.p, top: true }];
  while (queue.length) {
    const part = queue.shift();
    if (!part.p) continue;
    if (part.top || part.p.some((kid) => kid.s.length > 1)) pictures.push(picture(strokes, part));
    queue.push(...part.p);
  }
  return '<div class="row"><div class="top">' + file.c + '</div>' + pictures.join('') + '</div>';
}

Promise.all(FILES.map(row)).then((rows) => {
  document.getElementById('rows').innerHTML = rows.join('');
});
</script>
`;

function main() {
  const [chars, out = 'breakdown-review.html'] = process.argv.slice(2);
  if (!chars) {
    console.error('Usage: node review-breakdowns.js <characters> [output file]');
    process.exit(1);
  }
  const files = [];
  for (const char of new Set(chars)) {
    const file = path.join(BREAKDOWNS_DIR, breakdownFileName(char) + '.json');
    if (!fs.existsSync(file)) {
      console.log(`No breakdown file for ${char}. Run \`npm run build:dict\` first.`);
      continue;
    }
    files.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  fs.writeFileSync(out, PAGE(files));
  console.log(`Wrote the breakdown of ${files.length} characters to: ${out}`);
}

main();
