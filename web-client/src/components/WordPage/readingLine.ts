import { copy } from '../../copy';
import { sensesLine } from '../../utils/wordPage';
import { ReadingsLoad } from './useCharacterReadings';

/** The line of a character in the table: its reading in the word, or why there is none. */
export const readingLine = (load: ReadingsLoad): { pinyin: string; senses: string } => {
  if (load === undefined) return { pinyin: '', senses: '' };
  if (load === 'failed') return { pinyin: '', senses: copy.test.definitionFailed };
  const reading = load.inWord ?? load.others[0];
  if (!reading) return { pinyin: '', senses: copy.test.notInDictionary };
  return { pinyin: reading.pinyin, senses: sensesLine(reading) };
};
