/**
 * The example sentences of the Comprehend and Compose tabs, and of the hint.
 *
 * `npm run build:dict` writes them to `/sentences/` on Hosting, one file for
 * each first character of a word (#465, #469). A sentence costs one fetch of
 * its file and nothing more: no AI call, no Firestore read, and no dictionary
 * call, because each segment carries its own pinyin and gloss.
 */

import { SentenceSegment } from '../utils/sentenceUtils';
import { reportedSentenceIds } from '../utils/reportedSentences';

/** One sentence of a word, as the build writes it. */
interface FileSentence {
  id: string;
  simp: string;
  trad: string;
  english: string;
  segments: SentenceSegment[];
  targetIndex: number;
}

/** One file: the sentences of each word that starts with its character. */
type SentenceFile = Record<string, FileSentence[]>;

export interface SegmentedSentenceResult {
  sentence: {
    /** The id of the sentence in the files. */
    id: string;
    chinese: {
      sentence: string;
      highlight: number[][];
      /** The segments in order, with the text between them as segments with no entry. */
      segments: SentenceSegment[];
      targetIndex: number;
    };
    english: {
      sentence: string;
      highlight: number[][];
    };
  } | null;
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

async function sentencesOf(word: string): Promise<FileSentence[]> {
  if (!word) return [];
  const file = await fileOf(word);
  const reported = reportedSentenceIds();
  return (file[word] ?? []).filter((sentence) => !reported.has(sentence.id));
}

/**
 * The ids of the sentences of each word, by its text, in file order. A word
 * with no sentence has an empty list. The Comprehend and Compose tabs build
 * their queue from it (#489).
 */
export async function sentenceIndexOf(words: string[]): Promise<Record<string, string[]>> {
  const unique = Array.from(new Set(words));
  const lists = await Promise.all(unique.map((word) => sentencesOf(word)));
  return Object.fromEntries(
    unique.map((word, i) => [word, lists[i].map((sentence) => sentence.id)]),
  );
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
 * One sentence of a word: the one with the id, or the first one when no id is
 * given. No sentence when the word has none, or none with the id.
 */
export async function getSegmentedSentence(
  word: string,
  charSet: 'simp' | 'trad',
  sentenceId?: string,
): Promise<SegmentedSentenceResult> {
  const examples = await sentencesOf(word);
  const example =
    sentenceId === undefined
      ? examples[0]
      : examples.find((candidate) => candidate.id === sentenceId);

  if (!example) {
    return { sentence: null, totalCount: examples.length };
  }

  const { segments, targetIndex } = withGaps(example);
  const text = charSet === 'trad' ? example.trad : example.simp;
  const target = segments[targetIndex];
  const highlight = calculateHighlightIndices(
    text,
    target ? target[charSet === 'trad' ? 't' : 's'] : '',
  );

  return {
    sentence: {
      id: example.id,
      chinese: { sentence: text, highlight, segments, targetIndex },
      english: { sentence: example.english, highlight: [] },
    },
    totalCount: examples.length,
  };
}

export async function getHintSentence(
  word: string,
): Promise<{ chinese: string; english: string } | null> {
  const examples = await sentencesOf(word);
  if (examples.length === 0) return null;
  const selected = examples[Math.floor(Math.random() * examples.length)];
  return { chinese: selected.simp, english: selected.english };
}
