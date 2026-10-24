import { pinyin } from 'pinyin-pro';

/** How one heard syllable compares with the word: right, wrong tone, or wrong sound. */
export type SyllableMatch = 'match' | 'tone' | 'sound';

export interface HeardSyllable {
  /** The syllable heard, in tone numbers with 0 for the neutral tone; empty when missing. */
  text: string;
  match: SyllableMatch;
}

// Tone numbers, with ü as v and the neutral tone as 0, so that the stored
// pinyin and pinyin-pro's reading of the transcript compare as strings.
const normalise = (syllable: string): string =>
  syllable.toLowerCase().replace(/u:|ü/g, 'v').replace(/5$/, '0');

const sound = (syllable: string): string => syllable.replace(/[0-5]$/, '');

/**
 * Compare a speech transcript with the word's pinyin, syllable by syllable.
 * The word's result is its worst syllable: a wrong sound outranks a wrong tone.
 * A neutral syllable takes any tone, since a recognizer rarely hears it as one.
 */
export function compareSpeech(
  transcript: string,
  wordPinyin: string,
): { syllables: HeardSyllable[]; result: SyllableMatch } {
  const heard = pinyin(transcript, { toneType: 'num', type: 'array', v: true }).map(normalise);
  const expected = wordPinyin.trim().split(/\s+/).map(normalise);

  const syllables = expected.map((want, i): HeardSyllable => {
    const got = heard[i] ?? '';
    if (!got || sound(got) !== sound(want)) return { text: got, match: 'sound' };
    const sameTone = want.endsWith('0') || got.slice(-1) === want.slice(-1);
    return { text: got, match: sameTone ? 'match' : 'tone' };
  });

  const result: SyllableMatch = syllables.some((s) => s.match === 'sound')
    ? 'sound'
    : syllables.some((s) => s.match === 'tone')
      ? 'tone'
      : 'match';
  return { syllables, result };
}
