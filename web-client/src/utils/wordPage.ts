/**
 * The rules of the word page (#562): the senses of an entry, the characters
 * of a word, and the reading of each character in the word.
 */
import { Word } from '../types/models';
import { toneMarks } from './pinyinMarks';

/** A custom word has a negative id: the learner wrote it, and the dictionary has no entry. */
export const isCustomWord = (word: Pick<Word, 'id'>): boolean => word.id < 0;

/** The senses of a CC-CEDICT meaning: its parts between slashes. */
export const sensesOf = (meaning: string): string[] =>
  meaning
    .split('/')
    .map((sense) => sense.trim())
    .filter(Boolean);

/** The hanzi of a text, in order. A digit or a Latin letter gets no block. */
export const hanziOf = (text: string): string[] =>
  Array.from(text).filter((char) => /[\u3400-\u9fff\uf900-\ufaff]/.test(char));

/** One reading of one character: its pinyin in tone marks and its senses. */
export interface CharacterReading {
  pinyin: string;
  senses: string[];
}

/** The readings of a character, with the one that the word uses first. */
export interface CharacterReadings {
  /** The reading of the character in this word, or null when none matches. */
  inWord: CharacterReading | null;
  others: CharacterReading[];
}

/**
 * Split the dictionary entries of one character into the reading that the
 * word uses and the rest. The reading matches the syllable of the word at the
 * place of the character: 行 in 银行 is háng, not xíng. An exact match wins
 * over one that differs only in case, so 書 shū (book) wins over 書 Shū (a
 * surname). With no syllable, no reading matches.
 */
export function readingsInWord(
  entries: Pick<Word, 'pinyin' | 'meaning'>[],
  syllable: string | null,
): CharacterReadings {
  const readings = entries.map((entry) => ({
    pinyin: toneMarks(entry.pinyin),
    senses: sensesOf(entry.meaning),
  }));
  const wanted = syllable ? toneMarks(syllable).normalize('NFC') : null;
  const inWord = wanted
    ? (readings.find((r) => r.pinyin.normalize('NFC') === wanted) ??
      readings.find((r) => r.pinyin.normalize('NFC').toLowerCase() === wanted.toLowerCase()) ??
      null)
    : null;
  return { inWord, others: readings.filter((reading) => reading !== inWord) };
}

/**
 * The syllable of the word at each character, or null for each when the
 * pinyin does not split into one syllable per character.
 */
export function syllablesOf(word: Pick<Word, 'pinyin'>, count: number): (string | null)[] {
  const syllables = word.pinyin.trim().split(/\s+/);
  return syllables.length === count ? syllables : Array(count).fill(null);
}

/** The first senses of a reading, as one line. */
export const sensesLine = (reading: CharacterReading, count = 3): string =>
  reading.senses.slice(0, count).join(' · ');
