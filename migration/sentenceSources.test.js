import { describe, it, expect } from 'vitest';
import { formatSourceFile, scriptSets, tatoebaRecords, wiktionaryRecords } from './sentenceSources';

/** Lines in the column order of the Tatoeba exports. */
const sentence = (id, text, owner = 'alice') =>
  `${id}\tcmn\t${text}\t${owner}\t2010-01-01 00:00:00\t2010-01-01 00:00:00`;
const english = (id, text, owner = 'bob') =>
  `${id}\teng\t${text}\t${owner}\t2010-01-01 00:00:00\t2010-01-01 00:00:00`;
const link = (cmn, eng) => `${cmn}\t${eng}`;
const transcription = (id, script, text) => `${id}\tcmn\t${script}\t\t${text}`;
const tag = (id, name) => `${id}\t${name}`;
const level = (username, value) => `cmn\t${value}\t${username}\t`;

/** 們/们, 書/书 and 說/说 differ between the scripts; 我 and 看 do not. */
const scripts = scriptSets([
  { trad: '我們', simp: '我们' },
  { trad: '書', simp: '书' },
  { trad: '說', simp: '说' },
  { trad: '看', simp: '看' },
]);

const tatoeba = (input) =>
  tatoebaRecords(
    {
      sentences: [],
      links: [],
      english: [],
      transcriptions: [],
      tags: [],
      userLanguages: [],
      ...input,
    },
    scripts,
  );

describe('tatoebaRecords', () => {
  it('turns a Mandarin sentence with an English link into a record', () => {
    const records = tatoeba({
      sentences: [sentence(1, '我们看书。')],
      english: [english(10, 'We read.')],
      links: [link(1, 10)],
      transcriptions: [transcription(1, 'Hant', '我們看書。'), transcription(1, 'Latn', 'wo3men5')],
      userLanguages: [level('alice', 5)],
    });
    expect(records).toEqual([
      {
        source: 'tatoeba',
        sourceId: '1',
        written: 'simp',
        simp: '我们看书。',
        trad: '我們看書。',
        english: 'We read.',
        owner: 'alice',
        ownerLevel: 5,
        englishId: '10',
        englishOwner: 'bob',
        origin: { chinese: 'human', english: 'human' },
      },
    ]);
  });

  it('takes the simplified form of a traditional sentence from its transcription', () => {
    const [record] = tatoeba({
      sentences: [sentence(2, '我們看書。')],
      english: [english(10, 'We read.')],
      links: [link(2, 10)],
      transcriptions: [transcription(2, 'Hans', '我们看书。')],
    });
    expect(record).toMatchObject({ written: 'trad', simp: '我们看书。', trad: '我們看書。' });
  });

  it('drops the sentences tagged as wrong', () => {
    const sentences = [1, 2, 3, 4, 5, 6].map((id) => sentence(id, '我们看书。'));
    const records = tatoeba({
      sentences,
      english: [english(10, 'We read.')],
      links: [1, 2, 3, 4, 5, 6].map((id) => link(id, 10)),
      transcriptions: [1, 2, 3, 4, 5, 6].map((id) => transcription(id, 'Hant', '我們看書。')),
      tags: [
        tag(1, '@needs native check'),
        tag(2, '@change'),
        tag(3, '@delete'),
        tag(4, '@wrong transliteration'),
        tag(5, 'OK'),
        tag(5, '@change punctuation'),
      ],
    });
    expect(records.map((r) => r.sourceId)).toEqual(['5', '6']);
  });

  it('drops a sentence that mixes the two scripts', () => {
    const records = tatoeba({
      sentences: [sentence(1, '我们看書。'), sentence(2, '我看书。')],
      english: [english(10, 'We read.')],
      links: [link(1, 10), link(2, 10)],
      transcriptions: [
        transcription(1, 'Hant', '我們看書。'),
        transcription(2, 'Hant', '我看書。'),
      ],
    });
    expect(records.map((r) => r.sourceId)).toEqual(['2']);
  });

  it('drops a sentence with no direct link to an English sentence', () => {
    const records = tatoeba({
      sentences: [sentence(1, '我看书。')],
      english: [english(10, 'I read.')],
      links: [link(1, 99)],
      transcriptions: [transcription(1, 'Hant', '我看書。')],
    });
    expect(records).toEqual([]);
  });

  it('takes the English sentence with the lowest id when there are several', () => {
    const [record] = tatoeba({
      sentences: [sentence(1, '我看书。')],
      english: [english(30, 'I am reading.'), english(4, 'I read.')],
      links: [link(1, 30), link(1, 4)],
      transcriptions: [transcription(1, 'Hant', '我看書。')],
    });
    expect(record).toMatchObject({ english: 'I read.', englishId: '4' });
  });

  it('keeps the skill level of the owner, and null where the owner gave none', () => {
    const records = tatoeba({
      sentences: [sentence(1, '我看书。', 'alice'), sentence(2, '我看书。', 'carol'), sentence(3, '我看书。', '\\N')],
      english: [english(10, 'I read.')],
      links: [link(1, 10), link(2, 10), link(3, 10)],
      transcriptions: [1, 2, 3].map((id) => transcription(id, 'Hant', '我看書。')),
      userLanguages: [level('alice', 3), level('carol', '\\N')],
    });
    expect(records.map((r) => [r.owner, r.ownerLevel])).toEqual([
      ['alice', 3],
      ['carol', null],
      [null, null],
    ]);
  });
});

/** One kaikki example. */
const example = (script, text, roman, english, extra = {}) => ({
  type: 'example',
  tags: [`${script}-Chinese`],
  text,
  roman,
  english,
  translation: english,
  ...extra,
});

/** One kaikki JSONL line: a page with one sense that holds the examples. */
const page = (word, ...examples) =>
  JSON.stringify({ word, lang: 'Chinese', pos: 'verb', senses: [{ examples }] });

describe('wiktionaryRecords', () => {
  it('pairs the traditional and simplified records of one example', () => {
    const records = wiktionaryRecords([
      page(
        '看',
        example('Traditional', '我們看書。', 'Wǒmen kàn shū.', 'We read.'),
        example('Simplified', '我们看书。', 'Wǒmen kàn shū.', 'We read.'),
      ),
    ]);
    expect(records).toEqual([
      {
        source: 'wiktionary',
        sourceId: '看',
        written: 'trad',
        simp: '我们看书。',
        trad: '我們看書。',
        english: 'We read.',
        owner: null,
        headword: '看',
        url: 'https://en.wiktionary.org/wiki/%E7%9C%8B#Chinese',
        origin: { chinese: 'human', english: 'human' },
      },
    ]);
  });

  it('keeps a traditional record with no simplified partner as traditional only', () => {
    const records = wiktionaryRecords([
      page('看', example('Traditional', '看看', 'kànkàn', 'to have a look')),
    ]);
    expect(records).toMatchObject([{ written: 'trad', simp: null, trad: '看看' }]);
  });

  it('keeps examples and drops quotations', () => {
    const records = wiktionaryRecords([
      page(
        '看',
        { type: 'quotation', text: '看', english: 'look', roman: 'kàn' },
        example('Traditional', '看看', 'kànkàn', 'to have a look'),
      ),
    ]);
    expect(records.map((r) => r.trad)).toEqual(['看看']);
  });

  it('drops an example with no English or no romanization', () => {
    const records = wiktionaryRecords([
      page(
        '看',
        example('Traditional', '看看', 'kànkàn', undefined),
        example('Traditional', '看書', undefined, 'to read'),
      ),
    ]);
    expect(records).toEqual([]);
  });

  it('keeps Mandarin only', () => {
    const tagged = (tags, roman = 'kàn') =>
      example('Traditional', '看', roman, 'to look', { tags: ['Traditional-Chinese', ...tags] });
    const rawTagged = (rawTags) =>
      example('Traditional', '看', 'kàn', 'to look', { raw_tags: rawTags });
    const records = wiktionaryRecords([
      page(
        '看',
        tagged(['Cantonese']),
        tagged(['Jyutping'], 'hon3'),
        tagged(['Classical-Chinese']),
        rawTagged(['Literary Cantonese']),
        rawTagged(['Wugniu']),
        rawTagged(['Pe̍h-ōe-jī']),
        tagged(["Peng'im"], 'kang³'),
        tagged(['Pinyin']),
      ),
    ]);
    expect(records).toHaveLength(1);
  });

  it('drops a page with no Han character in its title', () => {
    const records = wiktionaryRecords([page('( )', example('Traditional', '看看', 'kànkàn', 'to look'))]);
    expect(records).toEqual([]);
  });

  it('keeps one record of an example that a page repeats', () => {
    const pair = [
      example('Traditional', '我們看書。', 'Wǒmen kàn shū.', 'We read.'),
      example('Simplified', '我们看书。', 'Wǒmen kàn shū.', 'We read.'),
    ];
    const records = wiktionaryRecords([page('看', ...pair, ...pair)]);
    expect(records).toHaveLength(1);
  });
});

describe('formatSourceFile', () => {
  const record = (sourceId, simp) => ({ source: 'tatoeba', sourceId, simp, trad: null, english: 'x' });

  it('writes the header, then one record per line in source id order', () => {
    const text = formatSourceFile({
      source: 'tatoeba',
      downloaded: '2026-11-01',
      licence: { name: 'CC BY 2.0 FR' },
      records: [record('10', '十'), record('9', '九'), record('10', '一')],
    });
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(5);
    expect(JSON.parse(text)).toEqual({
      source: 'tatoeba',
      downloaded: '2026-11-01',
      licence: { name: 'CC BY 2.0 FR' },
      records: [record('9', '九'), record('10', '一'), record('10', '十')],
    });
  });
});
