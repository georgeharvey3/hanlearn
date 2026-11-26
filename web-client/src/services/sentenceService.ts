/**
 * The example sentences of the word page, the new word introduction, the hint,
 * and the Comprehend and Compose tabs.
 *
 * `npm run build:dict` writes them to `/sentences/` on Hosting, one file for
 * each first character of a word (#465, #469). A sentence costs one fetch of
 * its file and nothing more: no AI call, no Firestore read, and no dictionary
 * call, because each segment carries its own pinyin and gloss.
 */

import { SegmentedSentence, SentenceOption, SentenceSegment } from '../utils/sentenceUtils';
import {
  isOptionReported,
  reportedOptionKeys,
  reportedSentenceIds,
} from '../utils/reportedSentences';
import { SentenceTab } from '../utils/sentenceSettings';

/**
 * The pool of a sentence in the list of one word (#581). The intro pool serves
 * the word page, the new word introduction and the hint.
 */
export type SentencePool = 'intro' | SentenceTab;

/** One sentence of a word, as the build writes it. */
interface FileSentence {
  id: string;
  simp: string;
  trad: string;
  english: string;
  segments: SentenceSegment[];
  targetIndex: number;
  pool: SentencePool;
  /** The tiles of tile mode, one character each, in both character sets (#386). */
  tiles?: { s: string; t: string };
  /** The false English readings of the Comprehend options (#601). */
  distractors?: SentenceOption[];
}

/** One file: the sentences of each word that starts with its character. */
type SentenceFile = Record<string, FileSentence[]>;

export interface SegmentedSentenceResult {
  sentence: SegmentedSentence | null;
  totalCount: number;
}

/**
 * The files fetched in this session. A promise, so that two words of one file
 * that load at the same moment share one fetch. A failed
 * fetch leaves the map, so the next call tries again.
 */
const files = new Map<string, Promise<SentenceFile>>();

/** The name of the file that holds a word: the hex code point of its first character. */
const fileNameOf = (word: string): string => word.codePointAt(0)!.toString(16);

async function fetchFile(name: string): Promise<SentenceFile> {
  const response = await fetch(`/sentences/${name}.json`);
  // A character with no file gets the app page of the SPA rewrite on Hosting,
  // and a 404 from the dev server. Neither one is an error: the word has no
  // sentences.
  // A server error throws, so that the session does not keep an empty copy.
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Sentence file ${name}: HTTP ${response.status}`);
  const type = response.headers.get('Content-Type') ?? '';
  if (!type.includes('json')) return {};
  return (await response.json()) as SentenceFile;
}

function fileOf(word: string): Promise<SentenceFile> {
  const name = fileNameOf(word);
  let file = files.get(name);
  if (!file) {
    file = fetchFile(name);
    files.set(name, file);
    file.catch(() => files.delete(name));
  }
  return file;
}

/**
 * The pools that an empty pool borrows from, nearest first. A word with 1 or
 * 2 sentences, or with a reported one, still shows a sentence in each place.
 * A tab that borrows shows a sentence that the learner met elsewhere: the
 * trade of priming for coverage, which a word with a sentence in each pool
 * never makes. The order is a rule to tune, not an ADR (#581).
 */
const BORROW: Record<SentencePool, SentencePool[]> = {
  intro: ['intro', 'comprehend', 'compose'],
  comprehend: ['comprehend', 'compose', 'intro'],
  compose: ['compose', 'comprehend', 'intro'],
};

/**
 * The one sentence of each pool of a word, after borrowing, or null when the
 * word has none left. The split comes before the reports leave, so a report
 * never moves a sentence into another pool. Pure.
 */
export function poolSentences<T extends { id: string; pool: SentencePool }>(
  sentences: T[],
  reported: ReadonlySet<string>,
): Record<SentencePool, T | null> {
  const own = (pool: SentencePool): T | undefined =>
    sentences.find((sentence) => sentence.pool === pool && !reported.has(sentence.id));
  const of = (pool: SentencePool): T | null =>
    BORROW[pool].map(own).find((sentence) => sentence !== undefined) ?? null;
  return { intro: of('intro'), comprehend: of('comprehend'), compose: of('compose') };
}

interface WordSentences {
  /** The sentences of the word that the learner did not report, in file order. */
  kept: FileSentence[];
  pools: Record<SentencePool, FileSentence | null>;
}

async function sentencesOf(word: string): Promise<WordSentences> {
  const all = word ? ((await fileOf(word))[word] ?? []) : [];
  const reported = reportedSentenceIds();
  return {
    kept: all.filter((sentence) => !reported.has(sentence.id)),
    pools: poolSentences(all, reported),
  };
}

/**
 * The sentence id of each tab for each word, by its text, after borrowing. A
 * word with no sentence has no entry. The Comprehend and Compose tabs build
 * their queue from it (#489, #581).
 */
export async function sentenceIndexOf(
  words: string[],
): Promise<Record<string, Record<SentenceTab, string>>> {
  const unique = Array.from(new Set(words));
  const all = await Promise.all(unique.map((word) => sentencesOf(word)));
  const index: Record<string, Record<SentenceTab, string>> = {};
  unique.forEach((word, i) => {
    const { comprehend, compose } = all[i].pools;
    if (comprehend && compose) index[word] = { comprehend: comprehend.id, compose: compose.id };
  });
  return index;
}

function calculateHighlightIndices(sentence: string, word: string): number[][] {
  const indices: number[][] = [];
  if (!word) return indices;
  let startIndex = 0;
  while (true) {
    const index = sentence.indexOf(word, startIndex);
    if (index === -1) break;
    indices.push([index, index + word.length]);
    startIndex = index + word.length;
  }
  return indices;
}

/**
 * The segments of a sentence with the text between them, so that the stage
 * shows the punctuation too. The build writes the Han segments only, in order.
 * The traditional text changes the characters one for one, so the simplified
 * text gives the position of each segment in both. A sentence that breaks
 * these rules keeps its segments as they are, with no gaps.
 */
function withGaps(sentence: FileSentence): { segments: SentenceSegment[]; targetIndex: number } {
  const unchanged = { segments: sentence.segments, targetIndex: sentence.targetIndex };
  const simp = Array.from(sentence.simp);
  const trad = Array.from(sentence.trad);
  if (simp.length !== trad.length) return unchanged;

  const segments: SentenceSegment[] = [];
  let targetIndex = -1;
  let at = 0;
  const gap = (to: number): void => {
    if (to > at) {
      segments.push({
        s: simp.slice(at, to).join(''),
        t: trad.slice(at, to).join(''),
        p: '',
        e: '',
      });
    }
    at = to;
  };
  for (let i = 0; i < sentence.segments.length; i++) {
    const segment = sentence.segments[i];
    const length = Array.from(segment.s).length;
    let start = at;
    while (
      start + length <= simp.length &&
      simp.slice(start, start + length).join('') !== segment.s
    ) {
      start += 1;
    }
    if (start + length > simp.length) return unchanged;
    gap(start);
    if (i === sentence.targetIndex) targetIndex = segments.length;
    segments.push(segment);
    at = start + length;
  }
  gap(simp.length);
  return targetIndex === -1 ? unchanged : { segments, targetIndex };
}

/**
 * One sentence of a word: the one with the id, or the sentence of the intro
 * pool when no id is given. No sentence when the word has none, or none with
 * the id.
 */
export async function getSegmentedSentence(
  word: string,
  charSet: 'simp' | 'trad',
  sentenceId?: string,
): Promise<SegmentedSentenceResult> {
  const { kept, pools } = await sentencesOf(word);
  const example =
    sentenceId === undefined ? pools.intro : kept.find((candidate) => candidate.id === sentenceId);

  if (!example) {
    return { sentence: null, totalCount: kept.length };
  }

  const { segments, targetIndex } = withGaps(example);
  const text = charSet === 'trad' ? example.trad : example.simp;
  const target = segments[targetIndex];
  const reportedOptions = reportedOptionKeys();
  const highlight = calculateHighlightIndices(
    text,
    target ? target[charSet === 'trad' ? 't' : 's'] : '',
  );

  return {
    sentence: {
      id: example.id,
      chinese: { sentence: text, simplified: example.simp, highlight, segments, targetIndex },
      english: { sentence: example.english, highlight: [] },
      ...(example.tiles
        ? { tiles: Array.from(charSet === 'trad' ? example.tiles.t : example.tiles.s) }
        : {}),
      distractors: (example.distractors ?? []).filter(
        (option) => !isOptionReported(reportedOptions, example.id, option.id),
      ),
    },
    totalCount: kept.length,
  };
}

/** The sentence of the intro pool, so that the hint never shows a sentence that a tab tests. */
export async function getHintSentence(
  word: string,
): Promise<{ chinese: string; english: string } | null> {
  const { intro } = (await sentencesOf(word)).pools;
  return intro ? { chinese: intro.simp, english: intro.english } : null;
}
