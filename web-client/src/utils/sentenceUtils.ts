import { searchWord, substringMatch } from '../services/dictionaryService';
import { reportError } from '../services/errorReporting';

export interface SentenceWord {
  id: number;
  simp: string;
  trad: string;
  pinyin: string;
  meaning: string;
}

// What the cloud function / sentence service returns (segmented strings, no lookups)
export interface CloudSentence {
  chinese: {
    sentence: string;
    highlight: number[][];
    segments: string[];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

// Resolved sentence with full word data (used for rendering)
export interface ResolvedSentence {
  chinese: {
    sentence: string;
    words: (string | SentenceWord | SentenceWord[])[];
    highlight: number[][];
    targetIndex: number;
  };
  english: {
    sentence: string;
    highlight: number[][];
  };
}

/**
 * Resolve segmented word strings to full word objects using the static dictionary.
 *
 * Each segment is a separate Cloud Function call, so one failed lookup (a cold
 * start timing out on a slow connection, say) must not lose the whole sentence.
 * A segment whose lookup fails stays a plain string: the learner loses the
 * translation help for that one word and keeps the sentence.
 */
export async function resolveSentence(cloudSentence: CloudSentence): Promise<ResolvedSentence> {
  // Collect unique non-target segments
  const uniqueSegments = new Set<string>();
  cloudSentence.chinese.segments.forEach((seg, i) => {
    if (i !== cloudSentence.chinese.targetIndex) {
      uniqueSegments.add(seg);
    }
  });

  // Resolve all unique segments in parallel via static dictionary
  const segmentArray = Array.from(uniqueSegments);
  let lookupFailures = 0;
  let firstLookupError: unknown;
  const noteLookupFailure = (error: unknown): void => {
    lookupFailures += 1;
    if (firstLookupError === undefined) firstLookupError = error;
  };

  const lookupResults = await Promise.all(
    segmentArray.map(async (seg) => {
      try {
        const results = await searchWord(seg, 'simp');
        return { seg, word: results.length > 0 ? results[0] : null };
      } catch (error) {
        noteLookupFailure(error);
        return { seg, word: null, failed: true };
      }
    }),
  );
  const failedSegments = new Set(lookupResults.filter((r) => r.failed).map((r) => r.seg));

  const wordMap = new Map<string, SentenceWord>();
  for (const { seg, word } of lookupResults) {
    if (word) {
      wordMap.set(seg, {
        id: word.id,
        simp: word.simp,
        trad: word.trad,
        pinyin: word.pinyin,
        meaning: word.meaning,
      });
    }
  }

  const words: (SentenceWord | string | SentenceWord[])[] = await Promise.all(
    cloudSentence.chinese.segments.map(async (seg, i) => {
      if (i === cloudSentence.chinese.targetIndex) {
        return seg; // Target word stays as string marker
      }
      const resolved = wordMap.get(seg);
      if (resolved) return resolved;
      if (failedSegments.has(seg)) return seg;

      // No exact match — decompose into smaller dictionary-matched substrings
      let subWords: Awaited<ReturnType<typeof substringMatch>>;
      try {
        subWords = await substringMatch(seg, 'simp');
      } catch (error) {
        noteLookupFailure(error);
        return seg;
      }
      if (subWords.length === 0) return seg;
      if (subWords.length === 1 && subWords[0].id === -1) {
        // Single unknown character — keep as plain string
        return seg;
      }
      return subWords.map((w) => ({
        id: w.id,
        simp: w.simp,
        trad: w.trad,
        pinyin: w.pinyin,
        meaning: w.meaning,
      }));
    }),
  );

  if (lookupFailures > 0) {
    reportError(firstLookupError, {
      feature: 'sentence-resolve',
      level: 'warning',
      context: { failedLookups: lookupFailures, segments: cloudSentence.chinese.segments.length },
    });
  }

  return {
    chinese: {
      sentence: cloudSentence.chinese.sentence,
      highlight: cloudSentence.chinese.highlight,
      targetIndex: cloudSentence.chinese.targetIndex,
      words,
    },
    english: cloudSentence.english,
  };
}

/**
 * Match selected English text against the meaning fields of resolved Chinese sentence words.
 * Used in SentenceWrite to provide English→Chinese translation hints.
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
