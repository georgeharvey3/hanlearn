#!/usr/bin/env node
/**
 * Measure the memory cost of a cold `dictionary*` invocation.
 *
 * See issue #319 and docs/adr/0001-error-reporting-for-the-cloud-functions.md.
 * `loadDictionary()` in src/dictionary.ts reads data/dictionary.json and builds
 * two Map indexes over every entry. That work happens once per instance, on the
 * first call, and it decides the memory limit that the five `dictionary*`
 * functions need.
 *
 * The script reproduces the same work in the same order, and reports the peak
 * resident set size for each stage. On Linux the peak comes from VmHWM in
 * /proc/self/status, which is the kernel's own high-water mark, so a spike
 * inside JSON.parse cannot be missed between samples.
 *
 * Usage, from the repository root:
 *
 *   npm run build:dict                                  # writes data/dictionary.json
 *   node --expose-gc functions/scripts/measure-dictionary-memory.js
 *
 * Run it on the same Node major as the deployed runtime (see engines.node in
 * functions/package.json). The number is a floor, not the deployed number: a
 * 1st gen instance has a different allocator arena and about 400 MHz of CPU at
 * 256 MB. Confirm against the function's memory metric in Metrics Explorer
 * after a deploy.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;

/** The kernel's peak RSS for this process, in bytes. */
function peakRss() {
  try {
    const status = fs.readFileSync('/proc/self/status', 'utf8');
    const match = status.match(/^VmHWM:\s+(\d+)\s+kB$/m);
    if (match) return Number(match[1]) * 1024;
  } catch {
    // Not Linux, or no procfs. Fall through to the sampled value.
  }
  return process.memoryUsage().rss;
}

function currentRss() {
  return process.memoryUsage().rss;
}

const stages = [];

function record(name, elapsedMs) {
  stages.push({
    name,
    peakRssMb: peakRss() / MB,
    rssMb: currentRss() / MB,
    heapUsedMb: process.memoryUsage().heapUsed / MB,
    elapsedMs,
  });
}

function time(fn) {
  const started = process.hrtime.bigint();
  const result = fn();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  return { result, elapsedMs };
}

record('node baseline', 0);

// Stage 1: the modules that every instance loads before any handler runs.
// src/index.ts imports all of these at the top level, and the five dictionary
// functions are deployed in the same bundle, so they pay this cost too.
const coldStart = time(() => {
  require('firebase-functions');
  require('firebase-admin');
  require('@sentry/google-cloud-serverless');
  require('hanzi');
});
record('cold-start requires', coldStart.elapsedMs);

// Stage 1b: src/index.ts also calls admin.initializeApp() and admin.firestore()
// at module scope, so every instance pays for the Firestore client too.
const adminInit = time(() => {
  try {
    const admin = require('firebase-admin');
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'measurement' });
    admin.firestore();
  } catch (err) {
    console.warn(`admin.initializeApp() failed locally (${err.message}); this stage is a floor.`);
  }
});
record('admin.initializeApp + firestore', adminInit.elapsedMs);

// Stage 1c: initSentry() runs at cold start whenever SENTRY_DSN is set, which
// it is in production. The DSN below is syntactically valid and unroutable, so
// the SDK starts without sending anything.
const sentryInit = time(() => {
  const Sentry = require('@sentry/google-cloud-serverless');
  Sentry.init({
    dsn: process.env.SENTRY_DSN || 'https://0000000000000000@o0.ingest.sentry.io/0',
    tracesSampleRate: 0,
  });
});
record('Sentry.init', sentryInit.elapsedMs);

// Stage 2: read and parse the bundled dictionary.
const dictPath = path.join(__dirname, '..', 'data', 'dictionary.json');
if (!fs.existsSync(dictPath)) {
  console.error(`No dictionary at ${dictPath}. Run "npm run build:dict" first.`);
  process.exit(1);
}
const fileSizeMb = fs.statSync(dictPath).size / MB;

const parsed = time(() => JSON.parse(fs.readFileSync(dictPath, 'utf8')));
const entries = parsed.result;
record('read + JSON.parse', parsed.elapsedMs);

// Stage 3: the two Map indexes that loadDictionary builds.
const indexed = time(() => {
  const simpIndex = new Map();
  const tradIndex = new Map();
  for (const entry of entries) {
    if (!simpIndex.has(entry.simp)) simpIndex.set(entry.simp, []);
    simpIndex.get(entry.simp).push(entry);
    if (!tradIndex.has(entry.trad)) tradIndex.set(entry.trad, []);
    tradIndex.get(entry.trad).push(entry);
  }
  return { simpIndex, tradIndex };
});
const { simpIndex, tradIndex } = indexed.result;
record('build both indexes', indexed.elapsedMs);

// Stage 4: what the instance holds for the rest of its life, after a full GC.
if (typeof global.gc === 'function') {
  global.gc();
  global.gc();
  record('after forced GC (steady state)', 0);
} else {
  console.warn('Run with --expose-gc for the steady-state figure.\n');
}

const peakMb = peakRss() / MB;

// The memory options that runWith() accepts for a 1st gen function. Pick the
// smallest one that leaves the headroom that issue #319 asks for.
const AVAILABLE_LIMITS = [
  { label: '128MB', mb: 128 },
  { label: '256MB', mb: 256 },
  { label: '512MB', mb: 512 },
  { label: '1GB', mb: 1024 },
  { label: '2GB', mb: 2048 },
  { label: '4GB', mb: 4096 },
  { label: '8GB', mb: 8192 },
];
const REQUIRED_HEADROOM = 0.3;
const recommended = AVAILABLE_LIMITS.find(
  (limit) => peakMb <= limit.mb * (1 - REQUIRED_HEADROOM)
);

const pad = (value, width) => String(value).padStart(width);
const fixed = (value) => value.toFixed(1);

console.log(`node ${process.version}   dictionary.json ${fixed(fileSizeMb)} MB   ${entries.length} entries`);
console.log(`index sizes: simp ${simpIndex.size} keys, trad ${tradIndex.size} keys\n`);
console.log('stage                            peak RSS   RSS   heapUsed    time');
console.log('-'.repeat(72));
for (const stage of stages) {
  console.log(
    `${stage.name.padEnd(30)} ${pad(fixed(stage.peakRssMb), 8)} ${pad(fixed(stage.rssMb), 6)} ${pad(fixed(stage.heapUsedMb), 9)} ${pad(fixed(stage.elapsedMs), 8)}ms`
  );
}
console.log('-'.repeat(72));
console.log(`\npeak RSS: ${fixed(peakMb)} MB`);
for (const limit of AVAILABLE_LIMITS) {
  if (limit.mb < peakMb) continue;
  const headroom = ((limit.mb - peakMb) / limit.mb) * 100;
  const mark = limit === recommended ? ' <- runWith({ memory })' : '';
  console.log(`  ${limit.label.padEnd(6)} ${pad(fixed(headroom), 5)}% free${mark}`);
}
if (!recommended) {
  console.log(
    `\nNo option leaves ${REQUIRED_HEADROOM * 100}% headroom. Shrink the index (issue #319, step 4).`
  );
}
