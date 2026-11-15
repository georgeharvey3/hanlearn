/**
 * Download the sources of the component breakdown (#528) into
 * components/source/:
 *
 * - dictionary.txt, COPYING and LGPL from Make Me a Hanzi, at one pinned commit
 * - stroke-counts.json: the stroke count of each character in the Hanzi
 *   Writer stroke data, the version that the app loads from the CDN
 *
 * build-dictionary.js reads only these committed files, with no network.
 *
 * Prerequisites: Node.js 18 or later, and `tar` on the PATH.
 *
 * Usage:
 *   node fetch-makemeahanzi.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/** The Make Me a Hanzi commit of the committed files. */
const MAKEMEAHANZI_COMMIT = 'bddc96d41bef78427ed0e034e9f7e31d71fd1b92';

/**
 * The Hanzi Writer data version. web-client/src/utils/charDataLoader.ts loads
 * `hanzi-writer-data@2.0`, which resolves to this release.
 */
const HANZI_WRITER_DATA = '2.0.1';

const SOURCE_DIR = path.join(__dirname, 'components', 'source');

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  for (const file of ['dictionary.txt', 'COPYING', 'LGPL']) {
    const url = `https://raw.githubusercontent.com/skishore/makemeahanzi/${MAKEMEAHANZI_COMMIT}/${file}`;
    console.log(`Downloading ${url}`);
    fs.writeFileSync(path.join(SOURCE_DIR, file), await download(url));
  }

  const url = `https://registry.npmjs.org/hanzi-writer-data/-/hanzi-writer-data-${HANZI_WRITER_DATA}.tgz`;
  console.log(`Downloading ${url}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hanzi-writer-data-'));
  try {
    const tarball = path.join(dir, 'data.tgz');
    fs.writeFileSync(tarball, await download(url));
    execFileSync('tar', ['-xzf', tarball, '-C', dir]);
    const packageDir = path.join(dir, 'package');
    const counts = {};
    for (const file of fs.readdirSync(packageDir).sort()) {
      if (!file.endsWith('.json') || file === 'package.json') continue;
      const data = JSON.parse(fs.readFileSync(path.join(packageDir, file), 'utf8'));
      counts[file.slice(0, -'.json'.length)] = data.strokes.length;
    }
    const out = path.join(SOURCE_DIR, 'stroke-counts.json');
    fs.writeFileSync(
      out,
      JSON.stringify({
        source: `hanzi-writer-data@${HANZI_WRITER_DATA}`,
        makemeahanzi: MAKEMEAHANZI_COMMIT,
        counts,
      }) + '\n',
    );
    console.log(`Wrote ${Object.keys(counts).length} stroke counts to: ${out}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
