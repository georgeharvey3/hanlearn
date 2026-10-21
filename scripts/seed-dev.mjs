/**
 * Seed the local emulators with a user and a word list for manual testing.
 *
 *   npm run emulators   # in one terminal
 *   npm run seed:dev    # in another; add -- --reset to clear the emulators first
 *
 * Then log in as dev@hanlearn.test / devpassword123.
 *
 * The words come from the built dictionary, so their ids match the entries the
 * app looks up. Each word gets a profile: new, learning, familiar, known,
 * mastered or leech. The directions of one word differ, as they do after real
 * sessions, so the session queue, the dashboard bars and the leech flag all
 * have something to show. Writes go to the emulators only, with the owner
 * token, which skips the security rules.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const AUTH_EMULATOR = 'http://localhost:9099';
const FIRESTORE_EMULATOR = 'http://localhost:8082';
const PROJECT_ID = 'hanlearn-dd14f';
const OWNER = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

const USER = { uid: 'dev-user', email: 'dev@hanlearn.test', password: 'devpassword123' };

const DIRECTIONS = ['MC', 'MP', 'PM', 'PC', 'CM'];
const DAY = 24 * 60 * 60 * 1000;

const PROFILES = {
  new: ['苹果', '图书馆', '飞机', '医生', '天气', '音乐'],
  learning: ['朋友', '吃饭', '咖啡', '工作', '漂亮', '电脑', '时间', '学校'],
  familiar: ['老师', '学生', '汉字', '今天', '明天', '喜欢', '东西'],
  known: ['你好', '谢谢', '再见', '我们', '妈妈'],
  mastered: ['爸爸', '水', '人', '大'],
  leech: ['已经', '虽然'],
};

// The interval range, in days, that each profile draws a direction from.
const INTERVALS = {
  learning: [1, 6],
  familiar: [7, 29],
  known: [30, 59],
  mastered: [60, 120],
  leech: [1, 3],
};

// A seeded random, so two runs give the same data.
let seed = 42;
function random() {
  seed = (seed * 1664525 + 1013904223) % 2 ** 32;
  return seed / 2 ** 32;
}
function between(low, high) {
  return low + Math.floor(random() * (high - low + 1));
}

function bankOf(interval) {
  if (interval <= 0) return 1;
  if (interval < 7) return 2;
  if (interval < 30) return 3;
  if (interval < 60) return 4;
  return 5;
}

const ts = (date) => ({ timestampValue: date.toISOString() });
const int = (n) => ({ integerValue: String(n) });
const dbl = (n) => ({ doubleValue: n });
const str = (s) => ({ stringValue: s });
const map = (fields) => ({ mapValue: { fields } });

function docUrl(path) {
  return `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
}

async function writeDoc(path, fields) {
  const res = await fetch(docUrl(path), {
    method: 'PATCH',
    headers: OWNER,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Failed to write ${path}: ${await res.text()}`);
}

/** The first dictionary entry for each word, skipping surnames and proper nouns. */
function lookUp(words) {
  const path = fileURLToPath(new URL('../web-client/public/dictionary.json', import.meta.url));
  const dictionary = JSON.parse(readFileSync(path, 'utf8'));
  const wanted = new Set(words);
  const found = new Map();
  for (const entry of dictionary) {
    if (!wanted.has(entry.simp) || found.has(entry.simp)) continue;
    if (/^[A-Z]/.test(entry.pinyin)) continue;
    found.set(entry.simp, entry);
  }
  const missing = words.filter((w) => !found.has(w));
  if (missing.length > 0) throw new Error(`Not in the dictionary: ${missing.join(', ')}`);
  return found;
}

/**
 * One direction of a reviewed word. The last review is one interval before the
 * due date, and the due date falls between a few days ago and a few days ahead,
 * so some directions are due now and some later.
 */
function reviewedDirection(profile, now) {
  const [low, high] = INTERVALS[profile];
  const interval = between(low, high);
  const dueDate = new Date(now.getTime() + between(-3, Math.min(interval, 5)) * DAY);
  const lastReview = new Date(dueDate.getTime() - interval * DAY);
  const fields = {
    bank: int(bankOf(interval)),
    dueDate: ts(dueDate),
    // The stability of an on-time direction is close to its interval.
    stability: dbl(interval * (0.9 + random() * 0.2)),
    difficulty: dbl(profile === 'leech' ? 8 + random() * 2 : 3 + random() * 4),
    interval: int(interval),
    lastReview: ts(lastReview),
  };
  if (profile === 'leech') fields.lapses = int(between(8, 11));
  else if (random() < 0.2) fields.lapses = int(between(1, 3));
  if (random() < 0.15) fields.toneErrors = int(between(1, 4));
  return { fields, bank: bankOf(interval), dueDate };
}

/** A new word: every direction at bank 1 with one shared due date, as addWordToList writes it. */
function newDirections(now) {
  const dueDate = new Date(now.getTime() - between(0, 4) * DAY);
  return Object.fromEntries(
    DIRECTIONS.map((d) => [d, { fields: { bank: int(1), dueDate: ts(dueDate) }, bank: 1, dueDate }]),
  );
}

async function reset() {
  await fetch(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: 'DELETE',
  });
  await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
}

async function createUser() {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchCreate`,
    {
      method: 'POST',
      headers: OWNER,
      body: JSON.stringify({
        users: [{ localId: USER.uid, email: USER.email, rawPassword: USER.password }],
      }),
    },
  );
  if (!res.ok) throw new Error(`Failed to create the user: ${await res.text()}`);
  // A second run reports the user as a duplicate in the body, which is fine.

  await writeDoc(`users/${USER.uid}`, {
    email: str(USER.email),
    username: str('dev'),
    createdAt: ts(new Date()),
  });
  await writeDoc(`users/${USER.uid}/wordLists/default`, {
    name: str('Default'),
    order: int(0),
    createdAt: ts(new Date()),
  });
}

async function seedWords() {
  const now = new Date();
  const entries = lookUp(Object.values(PROFILES).flat());
  let count = 0;

  for (const [profile, words] of Object.entries(PROFILES)) {
    for (const simp of words) {
      const entry = entries.get(simp);
      const directions =
        profile === 'new'
          ? newDirections(now)
          : Object.fromEntries(DIRECTIONS.map((d) => [d, reviewedDirection(profile, now)]));
      const states = Object.values(directions);

      await writeDoc(`users/${USER.uid}/userWords/${entry.id}`, {
        wordId: str(String(entry.id)),
        wordData: map({
          simp: str(entry.simp),
          trad: str(entry.trad),
          pinyin: str(entry.pinyin),
          meaning: str(entry.meaning),
        }),
        amendedMeaning: { nullValue: null },
        // The two derived fields: the lowest bank and the earliest due date.
        bank: int(Math.min(...states.map((s) => s.bank))),
        dueDate: ts(new Date(Math.min(...states.map((s) => s.dueDate.getTime())))),
        directions: map(Object.fromEntries(Object.entries(directions).map(([d, s]) => [d, map(s.fields)]))),
        addedAt: ts(new Date(now.getTime() - between(1, 90) * DAY)),
        listId: str('default'),
      });
      count++;
    }
  }
  return count;
}

async function main() {
  try {
    await fetch(`${FIRESTORE_EMULATOR}/`);
    await fetch(`${AUTH_EMULATOR}/`);
  } catch {
    throw new Error('The emulators are not running. Start them with `npm run emulators`.');
  }

  if (process.argv.includes('--reset')) {
    await reset();
    console.log('Cleared the emulators.');
  }
  await createUser();
  const count = await seedWords();
  console.log(`Seeded ${count} words. Log in as ${USER.email} / ${USER.password}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
