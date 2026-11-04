import { describe, it, expect } from 'vitest';
import { formatSourceFile, scriptSets, tatoebaRecords } from './tatoeba';

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

/** The records of the given exports. alice is a native Mandarin writer. */
const tatoeba = (input) =>
  tatoebaRecords(
    {
      sentences: [],
      links: [],
      english: [],
      transcriptions: [],
      tags: [],
      userLanguages: [level('alice', 5)],
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
        englishId: '10',
        englishOwner: 'bob',
        origin: { chinese: 'human', english: 'human' },
      },
    ]);
  });

  it('keeps only the sentences of an owner who gives Mandarin as their native language', () => {
    const records = tatoeba({
      sentences: [
        sentence(1, '我看书。', 'alice'),
        sentence(2, '我看书。', 'carol'),
        sentence(3, '我看书。', 'dave'),
        sentence(4, '我看书。', '\\N'),
      ],
      english: [english(10, 'I read.')],
      links: [1, 2, 3, 4].map((id) => link(id, 10)),
      transcriptions: [1, 2, 3, 4].map((id) => transcription(id, 'Hant', '我看書。')),
      userLanguages: [level('alice', 5), level('carol', 4), level('dave', '\\N')],
    });
    expect(records.map((r) => r.sourceId)).toEqual(['1']);
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
      transcriptions: [transcription(1, 'Hant', '我們看書。'), transcription(2, 'Hant', '我看書。')],
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
