/**
 * The data of the staging seed: a test account with words in more than one
 * list, the chengyus, and the dictionary entries that the chengyu functions
 * read from the `words` collection.
 *
 * Pure: seed-staging.js reads the files and writes the result. See issue #46.
 */

const PRODUCTION_PROJECT_ID = 'hanlearn-dd14f';

/** Stop before a write that would reach the production project. */
function assertNotProduction(projectId) {
  if (!projectId) throw new Error('No project id. Give the key of the staging service account.');
  if (projectId === PRODUCTION_PROJECT_ID) {
    throw new Error(`${projectId} is the production project. The seed writes to staging only.`);
  }
}

/** One string field of an object literal, in single or double quotes. */
function field(block, name) {
  const match = block.match(new RegExp(`\\b${name}:\\s*(['"])(.*?)\\1`, 's'));
  return match ? match[2] : undefined;
}

/**
 * The chengyus of web-client/src/data/chengyus.ts, read from its source text.
 * The file is TypeScript, and the seed runs in plain Node, so it cannot import
 * it. The fields are those of the `chengyus` collection in production.
 */
function parseChengyus(source) {
  const start = source.indexOf('export const chengyus');
  const end = source.indexOf('\n];', start);
  if (start === -1 || end === -1) throw new Error('The chengyus array was not found.');
  const blocks = source.slice(start, end).match(/\{[^{}]*\}/g) ?? [];
  return blocks.map((block) => {
    const chengyu = {
      characters: field(block, 'characters'),
      pinyin: field(block, 'pinyin'),
      meaning: field(block, 'meaning'),
    };
    if (Object.values(chengyu).some((value) => !value)) {
      throw new Error(`A chengyu has a missing field: ${block}`);
    }
    return chengyu;
  });
}

/**
 * The lists of the test account. General is built in, so it has no document.
 * Two words are in both lists, as a word that the learner adds to a second
 * list is.
 */
const SEED_LISTS = [
  { id: 'default', name: 'General', words: ['你好', '谢谢', '朋友', '老师', '学生', '喜欢', '再见', '天气'] },
  { id: 'travel', name: 'Travel', words: ['飞机', '火车', '酒店', '护照', '地图', '再见', '天气'] },
];

const DIRECTIONS = ['MC', 'MP', 'PM', 'PC', 'CM'];
const DAY = 24 * 60 * 60 * 1000;

/** The interval bands of the five levels. See docs/adr/0009-fsrs.md. */
function bankOf(interval) {
  if (interval <= 0) return 1;
  if (interval < 7) return 2;
  if (interval < 30) return 3;
  if (interval < 60) return 4;
  return 5;
}

/** The first common-noun entry of each word, as seed-dev.mjs picks it. */
function lookUp(dictionary, words) {
  const wanted = new Set(words);
  const found = new Map();
  for (const entry of dictionary) {
    if (!wanted.has(entry.simp) || found.has(entry.simp)) continue;
    if (/^[A-Z]/.test(entry.pinyin)) continue;
    found.set(entry.simp, entry);
  }
  const missing = words.filter((word) => !found.has(word));
  if (missing.length > 0) throw new Error(`Not in the dictionary: ${missing.join(', ')}`);
  return found;
}

/**
 * The directions of the word at `index`. One word in three is new: all five
 * directions at bank 1, as addWordToList writes them. The others have a
 * different interval in each direction, and due dates from two days ago to two
 * days ahead, so some are due now and some later.
 */
function directionsOf(index, now) {
  if (index % 3 === 0) {
    return Object.fromEntries(DIRECTIONS.map((d) => [d, { bank: 1, dueDate: now }]));
  }
  const base = index % 3 === 1 ? 2 : 20;
  return Object.fromEntries(
    DIRECTIONS.map((d, j) => {
      const interval = base + j * 4;
      const dueDate = new Date(now.getTime() + (j - 2) * DAY);
      return [
        d,
        {
          bank: bankOf(interval),
          dueDate,
          stability: interval,
          difficulty: 5,
          interval,
          lastReview: new Date(dueDate.getTime() - interval * DAY),
        },
      ];
    }),
  );
}

/**
 * The documents of the staging seed. Dates are `Date`s, which the Admin SDK
 * writes as timestamps.
 */
function buildSeed({ dictionary, chengyus, now }) {
  const words = [...new Set(SEED_LISTS.flatMap((list) => list.words))];
  const entries = lookUp(dictionary, words);

  const userWords = words.map((simp, index) => {
    const entry = entries.get(simp);
    const directions = directionsOf(index, now);
    const states = Object.values(directions);
    return {
      id: String(entry.id),
      data: {
        wordId: String(entry.id),
        wordData: { simp: entry.simp, trad: entry.trad, pinyin: entry.pinyin, meaning: entry.meaning },
        amendedMeaning: null,
        // The two derived fields: the lowest bank and the earliest due date.
        bank: Math.min(...states.map((s) => s.bank)),
        dueDate: new Date(Math.min(...states.map((s) => s.dueDate.getTime()))),
        directions,
        addedAt: now,
        listIds: SEED_LISTS.filter((list) => list.words.includes(simp)).map((list) => list.id),
      },
    };
  });

  const lists = SEED_LISTS.map((list, order) => ({ ...list, order }))
    .filter((list) => list.id !== 'default')
    .map((list) => ({ id: list.id, data: { name: list.name, order: list.order, createdAt: now } }));

  // getDailyChengyu and lookupChengyuChar read the entries of each character
  // from the `words` collection, under the dictionary id.
  const characters = new Set(chengyus.flatMap((c) => Array.from(c.characters)));
  const chengyuWords = dictionary
    .filter((entry) => characters.has(entry.simp))
    .map((entry) => ({
      id: String(entry.id),
      data: { simp: entry.simp, trad: entry.trad, pinyin: entry.pinyin, meaning: entry.meaning },
    }));

  return {
    lists,
    userWords,
    chengyus: chengyus.map((chengyu, index) => ({ id: String(index), data: chengyu })),
    words: chengyuWords,
  };
}

module.exports = { SEED_LISTS, assertNotProduction, buildSeed, parseChengyus };
