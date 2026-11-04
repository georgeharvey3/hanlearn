/**
 * The example sentences of the sentence stages and the hint.
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

const SENTENCES_PER_WORD = 5;

const ROTATION_KEY = 'sentenceRotation';

/**
 * The files fetched in this session. A promise, so that the Read stage and the
 * availability check that start at the same moment share one fetch. A failed
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
  const type = response.headers.get('Content-Type') ?? '';
  if (!response.ok || !type.includes('json')) return {};
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
 * Returns where this session should start in a word's sentences, and moves the
 * stored start on by two so the next session begins past both the Read and the
 * Write sentence. Without it every session showed the same sentences.
 */
export function takeSentenceStart(word: string): number {
  try {
    const rotation = JSON.parse(localStorage.getItem(ROTATION_KEY) ?? '{}') as Record<
      string,
      number
    >;
    const start = typeof rotation[word] === 'number' ? rotation[word] : 0;
    rotation[word] = start + 2;
    localStorage.setItem(ROTATION_KEY, JSON.stringify(rotation));
    return start;
  } catch {
    return Math.floor(Math.random() * SENTENCES_PER_WORD);
  }
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
 * text gives the position of each segment in both.
 */
function withGaps(sentence: FileSentence): { segments: SentenceSegment[]; targetIndex: number } {
  const segments: SentenceSegment[] = [];
  let targetIndex = sentence.targetIndex;
  const simp = Array.from(sentence.simp);
  const trad = Array.from(sentence.trad);
  let at = 0;
  const gap = (to: number): void => {
    if (to <= at) return;
    segments.push({ s: simp.slice(at, to).join(''), t: trad.slice(at, to).join(''), p: '', e: '' });
    at = to;
  };
  sentence.segments.forEach((segment, i) => {
    const length = Array.from(segment.s).length;
    let start = at;
    while (
      start + length <= simp.length &&
      simp.slice(start, start + length).join('') !== segment.s
    ) {
      start += 1;
    }
    // A segment that is not in the text (never in a built file) takes no gap.
    if (start + length > simp.length) start = at;
    gap(start);
    if (i === sentence.targetIndex) targetIndex = segments.length;
    segments.push(segment);
    at = start + length;
  });
  gap(simp.length);
  return { segments, targetIndex };
}

export async function getSegmentedSentence(
  word: string,
  charSet: 'simp' | 'trad',
  offset: number,
): Promise<SegmentedSentenceResult> {
  const examples = await sentencesOf(word);

  if (examples.length === 0) {
    return { sentence: null, totalCount: 0 };
  }

  // Offsets wrap, so a rotating start never runs off the end of the list.
  const example = examples[offset % examples.length];
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

export async function checkSentenceAvailability(
  word: string,
  charSet: 'simp' | 'trad',
): Promise<boolean> {
  const result = await getSegmentedSentence(word, charSet, 0);
  return result.sentence !== null;
}
