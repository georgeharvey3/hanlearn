import { describe, it, expect } from 'vitest';
import { attachDistractors, chooseDistractors, formatDistractors, parseBlockedPairs } from './distractors';

/**
 * A sentence of the build, in the output shape of exampleSentences.js. Each
 * segment is [simp, pinyin, gloss]. The target is the segment of the word.
 */
function sentence(id, word, english, segments, pool = 'comprehend') {
  const output = segments.map(([s, p, e]) => ({ s, t: s, p, e }));
  return {
    id,
    simp: output.map((segment) => segment.s).join('') + '。',
    english,
    segments: output,
    targetIndex: output.findIndex((segment) => segment.s === word),
    pool,
  };
}

/** The sentence files of the build: { [file]: { [word]: sentences } }. */
function filesOf(...sentences) {
  const files = {};
  for (const [word, one] of sentences) {
    const file = word.codePointAt(0).toString(16);
    files[file] ??= {};
    (files[file][word] ??= []).push(one);
  }
  return files;
}

/**
 * A fake embedding adapter: each English sentence is a unit vector at a given
 * angle, so the cosine of two sentences is the cosine of their angle
 * difference. The sentence under test is at 0, and a candidate at `cos` has
 * the angle acos(cos).
 */
function fakeEmbed(cosines) {
  return async (texts) =>
    texts.map((text) => {
      if (!(text in cosines)) throw new Error(`no fake vector for ${text}`);
      const angle = Math.acos(cosines[text]);
      return [Math.cos(angle), Math.sin(angle)];
    });
}

const HELP = ['帮助', 'bāng zhù', 'to help; to assist; to aid'];
const ME = ['我', 'wǒ', 'I; me; my'];
const HE = ['他', 'tā', 'he or him'];
const ALWAYS = ['一直', 'yī zhí', 'straight (in a straight line); continuously; always'];
const SECRET = ['暗中', 'àn zhōng', 'in the dark; in secret; on the sly'];
const FRIEND = ['朋友', 'péng you', 'friend'];
const POLICE = ['警察', 'jǐng chá', 'police; police officer'];
const OTHERS = ['别人', 'bié ren', 'other people; others; other person'];
const QUIETLY = ['悄悄', 'qiāo qiāo', 'quietly; secretly; stealthily'];
const LIFE = ['一生', 'yī shēng', 'all one\'s life; throughout one\'s life'];

/** 他一直在暗中帮助我。 for 暗中, at the cosine 1 of the fake adapter. */
const TARGET = sentence('target', '暗中', 'He has been helping me secretly all along.', [HE, ALWAYS, SECRET, HELP, ME]);

async function choose(candidates, { blocked = [] } = {}) {
  const files = filesOf(['暗中', TARGET], ...candidates.map(([word, one]) => [word, one]));
  const cosines = { [TARGET.english]: 1 };
  candidates.forEach(([, one, cos]) => (cosines[one.english] = cos));
  const { distractors, short } = await chooseDistractors(files, fakeEmbed(cosines), parseBlockedPairs(blocked));
  return { ids: distractors.target ?? [], short, distractors };
}

describe('choosing the distractors', () => {
  it('ranks the candidates by the content words they share, then by the cosine', async () => {
    const { ids } = await choose([
      ['朋友', sentence('a', '朋友', 'My friend helped me.', [FRIEND, HELP, ME]), 0.8],
      ['别人', sentence('b', '别人', 'He always helped others all his life.', [HE, LIFE, ALWAYS, HELP, OTHERS]), 0.7],
      ['警察', sentence('c', '警察', 'The police came.', [POLICE]), 0.82],
      ['一生', sentence('d', '一生', 'He was always with me.', [HE, ALWAYS, ME, LIFE]), 0.75],
    ]);
    // b shares 一直 and 帮助, a and d share one word each, c shares none.
    expect(ids).toEqual(['b', 'a', 'd']);
  });

  it('counts no word of the stop list as shared', async () => {
    const { ids } = await choose([
      ['朋友', sentence('a', '朋友', 'He is my friend.', [HE, ME, FRIEND]), 0.65],
      ['警察', sentence('c', '警察', 'The police helped.', [POLICE, HELP]), 0.61],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.8],
      ['别人', sentence('b', '别人', 'Others.', [OTHERS]), 0.7],
    ]);
    // Only c shares a content word: 他 and 我 do not count.
    expect(ids).toEqual(['c', 'd', 'b']);
  });

  it('leaves out a candidate outside the cosine band', async () => {
    const { ids } = await choose([
      ['朋友', sentence('a', '朋友', 'He has always helped me, my friend.', [FRIEND, ALWAYS, HELP, ME]), 0.9],
      ['别人', sentence('b', '别人', 'Others help.', [OTHERS, HELP]), 0.5],
      ['警察', sentence('c', '警察', 'The police help.', [POLICE, HELP]), 0.7],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.65],
      ['帮助', sentence('e', '帮助', 'Help me.', [HELP, ME]), 0.6],
    ]);
    expect(ids).toEqual(['c', 'e', 'd']);
  });

  it('leaves out the other sentences of the same word', async () => {
    const { ids } = await choose([
      ['暗中', sentence('own', '暗中', 'He helped in the dark.', [HE, SECRET, HELP]), 0.8],
      ['朋友', sentence('a', '朋友', 'Friends help.', [FRIEND, HELP]), 0.7],
      ['警察', sentence('c', '警察', 'The police.', [POLICE]), 0.75],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.65],
    ]);
    expect(ids).toEqual(['a', 'c', 'd']);
  });

  it('leaves out a candidate with a word whose gloss shares a content word with the target', async () => {
    const { ids } = await choose([
      ['悄悄', sentence('s', '悄悄', 'He quietly helped me.', [HE, QUIETLY, HELP, ME]), 0.8],
      ['朋友', sentence('a', '朋友', 'Friends help.', [FRIEND, HELP]), 0.7],
      ['警察', sentence('c', '警察', 'The police.', [POLICE]), 0.75],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.65],
    ]);
    // 悄悄 is "secretly", a synonym of 暗中: the option would be a true reading.
    expect(ids).toEqual(['a', 'c', 'd']);
  });

  it('gives no two options the same English', async () => {
    const { ids } = await choose([
      ['朋友', sentence('a', '朋友', 'A friend helps.', [FRIEND, HELP]), 0.7],
      ['别人', sentence('b', '别人', 'A friend helps!', [OTHERS, HELP]), 0.71],
      ['警察', sentence('c', '警察', 'The police.', [POLICE]), 0.75],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.65],
    ]);
    expect(ids).toEqual(['b', 'c', 'd']);
  });

  it('leaves out a candidate that sounds the same as the sentence', async () => {
    const SHE = ['她', 'tā', 'she'];
    const own = sentence('t2', '帮助', 'You should help her.', [['你', 'nǐ', 'you'], ['应该', 'yīng gāi', 'ought to; should'], HELP, SHE]);
    const files = filesOf(
      ['帮助', own],
      ['应该', sentence('him', '应该', 'You should help him.', [['你', 'nǐ', 'you'], ['应该', 'yīng gāi', 'ought to; should'], HELP, HE])],
      ['朋友', sentence('a', '朋友', 'Friends.', [FRIEND])],
      ['警察', sentence('c', '警察', 'The police.', [POLICE])],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE])],
    );
    const embed = fakeEmbed({
      [own.english]: 1,
      'You should help him.': 0.8,
      'Friends.': 0.7,
      'The police.': 0.75,
      'All his life.': 0.65,
    });
    const { distractors } = await chooseDistractors(files, embed, parseBlockedPairs([]));
    expect(distractors.t2).toEqual(['c', 'a', 'd']);
  });

  it('skips a blocked pair', async () => {
    const { ids } = await choose(
      [
        ['朋友', sentence('a', '朋友', 'Friends help.', [FRIEND, HELP]), 0.7],
        ['警察', sentence('c', '警察', 'The police.', [POLICE]), 0.75],
        ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.65],
        ['别人', sentence('b', '别人', 'Others.', [OTHERS]), 0.62],
      ],
      { blocked: [{ id: 'target', distractor: 'a', reason: 'A true reading.' }] },
    );
    expect(ids).toEqual(['c', 'd', 'b']);
  });

  it('fills from below the band only when the band gives fewer than 3', async () => {
    const { ids } = await choose([
      ['朋友', sentence('a', '朋友', 'Friends help.', [FRIEND, HELP]), 0.7],
      ['警察', sentence('c', '警察', 'The police help.', [POLICE, HELP]), 0.5],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE]), 0.55],
      ['别人', sentence('b', '别人', 'Others.', [OTHERS]), 0.4],
    ]);
    // c shares a word, so it ranks before d. b is below the floor.
    expect(ids).toEqual(['a', 'c', 'd']);
  });

  it('reports a sentence with fewer than 3 candidates', async () => {
    const { ids, short } = await choose([
      ['朋友', sentence('a', '朋友', 'Friends help.', [FRIEND, HELP]), 0.7],
      ['警察', sentence('c', '警察', 'The police.', [POLICE]), 0.95],
    ]);
    expect(ids).toEqual(['a']);
    expect(short).toContainEqual({ id: 'target', found: 1 });
  });

  it('serves a sentence of two words once, with the filters of both', async () => {
    const shared = sentence('target', '暗中', TARGET.english, [HE, ALWAYS, SECRET, HELP, ME]);
    const files = filesOf(
      ['暗中', shared],
      ['帮助', { ...shared, targetIndex: 3 }],
      ['帮助', sentence('h', '帮助', 'Help me.', [HELP, ME])],
      ['朋友', sentence('a', '朋友', 'Friends.', [FRIEND])],
      ['警察', sentence('c', '警察', 'The police.', [POLICE])],
      ['一生', sentence('d', '一生', 'All his life.', [LIFE])],
      ['别人', sentence('b', '别人', 'Others.', [OTHERS])],
    );
    const embed = fakeEmbed({
      [TARGET.english]: 1,
      'Help me.': 0.8,
      'Friends.': 0.7,
      'The police.': 0.75,
      'All his life.': 0.65,
      'Others.': 0.6,
    });
    const { distractors } = await chooseDistractors(files, embed, parseBlockedPairs([]));
    // h is a sentence of 帮助, and 一生 shares no gloss word with "to help".
    expect(distractors.target).toEqual(['c', 'a', 'd']);
  });
});

describe('the block list of distractors', () => {
  it('needs a reason for each pair', () => {
    expect(() => parseBlockedPairs([{ id: 'a', distractor: 'b' }])).toThrow(/a b: no reason/);
  });
});

describe('the distractor file', () => {
  it('writes one sorted line for each sentence', () => {
    const text = formatDistractors(
      { name: 'model', revision: 'abc' },
      { b: ['x', 'y', 'z'], a: ['p', 'q', 'r'] },
    );
    expect(JSON.parse(text).distractors).toEqual({ a: ['p', 'q', 'r'], b: ['x', 'y', 'z'] });
    expect(text.indexOf('"a"')).toBeLessThan(text.indexOf('"b"'));
    expect(text.split('\n').filter((line) => line.includes('["'))).toHaveLength(2);
  });
});

describe('attaching the distractors in the build', () => {
  const comprehend = sentence('s1', '暗中', 'He helped me secretly.', [HE, SECRET, HELP, ME]);
  const intro = sentence('s0', '暗中', 'In secret.', [SECRET], 'intro');
  const others = ['a', 'c', 'd'].map((id) => sentence(id, '朋友', `Sentence ${id}.`, [FRIEND], 'intro'));
  const files = () => filesOf(['暗中', intro], ['暗中', comprehend], ...others.map((one) => ['朋友', one]));
  const empty = { blockedSentences: new Set(), blockedPairs: parseBlockedPairs([]) };
  // The tab shows the first sentence of 朋友, a, by borrowing from the intro pool.
  const base = { a: ['c', 'd', 's0'] };

  it('writes the id and the English of each distractor into the sentence', () => {
    const built = files();
    const problems = attachDistractors(built, { ...base, s1: ['a', 'c', 'd'] }, empty);
    expect(problems).toEqual([]);
    expect(built['6697']['暗中'][1].distractors).toEqual([
      { id: 'a', english: 'Sentence a.' },
      { id: 'c', english: 'Sentence c.' },
      { id: 'd', english: 'Sentence d.' },
    ]);
  });

  it('fails when the sentence of the Comprehend tab has fewer than 3 distractors', () => {
    const problems = attachDistractors(files(), { ...base, s1: ['a', 'c'] }, empty);
    expect(problems).toEqual([expect.stringMatching(/s1 of 暗中: 2 distractors/)]);
  });

  it('checks the sentence that the tab borrows when the word has no Comprehend sentence', () => {
    const built = filesOf(['暗中', intro], ...others.map((one) => ['朋友', one]));
    const problems = attachDistractors(built, base, empty);
    expect(problems).toEqual([expect.stringMatching(/s0 of 暗中: 0 distractors/)]);
  });

  it('fails on a distractor that is not a built sentence', () => {
    const problems = attachDistractors(files(), { s1: ['a', 'c', 'gone'] }, empty);
    expect(problems).toContainEqual(expect.stringMatching(/s1: the distractor gone is not a built sentence/));
  });

  it('fails on a distractor that blocked.json blocks', () => {
    const problems = attachDistractors(files(), { s1: ['a', 'c', 'bad'] }, {
      ...empty,
      blockedSentences: new Set(['bad']),
    });
    expect(problems).toContainEqual(expect.stringMatching(/s1: the distractor bad is blocked in blocked.json/));
  });

  it('fails on a blocked pair', () => {
    const problems = attachDistractors(files(), { s1: ['a', 'c', 'd'] }, {
      ...empty,
      blockedPairs: parseBlockedPairs([{ id: 's1', distractor: 'c', reason: 'A true reading.' }]),
    });
    expect(problems).toContainEqual(expect.stringMatching(/s1: the distractor c is a blocked pair/));
  });
});
