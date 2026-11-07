import { convert, pinyin } from 'pinyin-pro';

/**
 * The pinyin line of an example sentence, in tone marks (#492).
 *
 * Pass the simplified text: pinyin-pro misreads many traditional characters,
 * common ones too (們 reads "mén", 嗎 "má"). It reads each character in its
 * context, which the CC-CEDICT pinyin of each segment does not. It also puts
 * a space before each punctuation mark, which this removes.
 */
export function sentencePinyin(simplified: string): string {
  return pinyin(simplified, { nonZh: 'consecutive' }).replace(SPACE_BEFORE_PUNCTUATION, '');
}

/** The spaces before a closing or ending mark, full-width or ASCII. */
const SPACE_BEFORE_PUNCTUATION = / +(?=[，。！？、；：…）」』”’,.!?;:)])/g;

/**
 * Write numbered pinyin with tone marks: "tu2 shu1 guan3" reads "tú shū guǎn".
 *
 * The dictionary stores tone numbers, which is also what the learner types.
 * A reveal shows the marks, because that is how pinyin is read. CC-CEDICT
 * writes ü as "u:", and a neutral tone as 5, which has no mark.
 */
export function toneMarks(numbered: string): string {
  const plain = dropNeutralTone(numbered).replace(/u:/gi, 'v');
  return convert(plain, { format: 'numToSymbol' });
}

/**
 * Remove the number of each neutral tone: "peng2 you0" reads "peng2 you".
 *
 * The learner may write a neutral tone as 0, 5, or no number. CC-CEDICT writes
 * 5, and speech recognition gives 0. Only a digit that follows a letter is a
 * tone, so a 0 or 5 elsewhere stays.
 */
export function dropNeutralTone(numbered: string): string {
  return numbered.replace(/([a-zü:v])[05]/gi, '$1');
}

/** One syllable of an attempt, and whether its tone is the wrong one. */
export interface SyllableCheck {
  syllable: string;
  wrongTone: boolean;
}

const SYLLABLE = /[a-zü:v]+[0-5]?/gi;

/**
 * Mark the syllables of an attempt whose tone differs from the answer.
 *
 * The engine calls an attempt "Incorrect tones" when only its numbers are
 * wrong, so the letters line up one to one. A neutral tone may be typed as 0
 * or 5, or left bare. The learner may leave out the spaces, so the syllables
 * are read by their tone numbers rather than split on spaces.
 */
export function checkTones(attempt: string, answer: string): SyllableCheck[] {
  const tone = (s: string) => (/[1-4]$/.test(s) ? s.slice(-1) : '');
  const typed = attempt.trim().match(SYLLABLE) ?? [];
  const expected = answer.trim().match(SYLLABLE) ?? [];
  return typed.map((syllable, i) => ({
    syllable,
    wrongTone: expected[i] !== undefined && tone(syllable) !== tone(expected[i]),
  }));
}
