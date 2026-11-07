import { searchWord } from '../services/dictionaryService';
import { Word } from '../types/models';
import { sentencePinyin, toneMarks } from './pinyinMarks';

/**
 * One segment of a sentence file: the simplified and traditional text, the
 * pinyin in tone marks, and the gloss. A segment with no entry has an empty
 * pinyin and gloss: punctuation, a name, or a number.
 */
export interface SentenceSegment {
  s: string;
  t: string;
  p: string;
  e: string;
}

/**
 * A word of a sentence that the learner can tap. Its `id` names the entry that
 * the segment shows (the text and the pinyin), not a dictionary entry: the
 * files carry no dictionary id. `dictionaryEntryOf` finds the entry when the
 * learner adds the word.
 */
export interface SentenceWord {
  id: string;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

/** What the sentence service returns: the segments of one sentence. */
export interface SegmentedSentence {
  id: string;
  chinese: {
    sentence: string;
    /** The simplified text, whatever the character set of `sentence`. */
    simplified: string;
    highlight: number[][];
    /** The segments in order, with the text between them as segments with no entry. */
    segments: SentenceSegment[];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

// Resolved sentence with full word data (used for rendering)
export interface ResolvedSentence {
  id: string;
  chinese: {
    sentence: string;
    /** The pinyin line, read from the simplified text (#492). */
    pinyin: string;
    /** The target and each segment with no entry are plain strings. */
    words: (string | SentenceWord)[];
    highlight: number[][];
    targetIndex: number;
    /** The entry of the target segment, or null when it has none. */
    target: SentenceWord | null;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

/**
 * Build the words of a sentence from its segments, with no network call. The
 * target and each segment with no entry stay plain strings, in the character
 * set of the sentence.
 */
export function resolveSentence(
  sentence: SegmentedSentence,
  charSet: 'simp' | 'trad',
): ResolvedSentence {
  const entryOf = (segment: SentenceSegment): SentenceWord => ({
    id: `${segment.s} ${segment.p}`,
    simp: segment.s,
    trad: segment.t,
    pinyin: segment.p,
    meaning: segment.e,
  });
  const words = sentence.chinese.segments.map((segment, i): string | SentenceWord => {
    const text = charSet === 'trad' ? segment.t : segment.s;
    if (i === sentence.chinese.targetIndex || !segment.p) return text;
    return entryOf(segment);
  });
  const targetSegment = sentence.chinese.segments[sentence.chinese.targetIndex];

  return {
    id: sentence.id,
    chinese: {
      sentence: sentence.chinese.sentence,
      pinyin: sentencePinyin(sentence.chinese.simplified),
      highlight: sentence.chinese.highlight,
      targetIndex: sentence.chinese.targetIndex,
      words,
      target: targetSegment?.p ? entryOf(targetSegment) : null,
    },
    english: sentence.english,
  };
}

/**
 * The dictionary entry of a word of a sentence, to add it to a list: the
 * Firestore document of a word takes the id of its entry. Prefers the entry
 * with the pinyin of the segment, then the first one with the same
 * characters. Null when the dictionary has none.
 */
export async function dictionaryEntryOf(word: SentenceWord): Promise<Word | null> {
  const entries = (await searchWord(word.simp, 'simp')).filter(
    (entry) => entry.simp === word.simp && entry.id !== -1,
  );
  const sameTrad = entries.filter((entry) => entry.trad === word.trad);
  const candidates = sameTrad.length > 0 ? sameTrad : entries;
  const plain = (pinyin: string) => pinyin.replace(/\s+/g, '').toLowerCase();
  return (
    candidates.find((entry) => plain(toneMarks(entry.pinyin)) === plain(word.pinyin)) ??
    candidates[0] ??
    null
  );
}

/**
 * Match selected English text against the meaning fields of resolved Chinese sentence words.
 * Used in the Compose tab to give English→Chinese translation hints.
 */
export function matchEnglishToSentenceWords(
  englishQuery: string,
  sentenceWords: SentenceWord[],
): SentenceWord[] {
  const query = englishQuery.toLowerCase().trim();
  if (!query) return [];

  const matches: SentenceWord[] = [];

  for (const word of sentenceWords) {
    const meaning = word.meaning.toLowerCase();
    // Check if any of the meanings contain the query as a substring
    if (meaning.includes(query)) {
      matches.push(word);
    }
  }

  // If phrase match found results, return them
  if (matches.length > 0) return matches;

  // Fall back to matching individual words in the query
  const queryWords = query.split(/\s+/);
  if (queryWords.length <= 1) return [];

  for (const word of sentenceWords) {
    const meaning = word.meaning.toLowerCase();
    for (const qw of queryWords) {
      if (qw.length > 1 && meaning.includes(qw)) {
        if (!matches.includes(word)) {
          matches.push(word);
        }
      }
    }
  }

  return matches;
}
