import { searchWord } from './dictionaryService';

/**
 * Look up meanings for each character in a chengyu
 */
export async function lookupCharacterMeanings(
  chars: string[],
  charSet: 'simp' | 'trad' = 'simp',
): Promise<{ char: string; meaning: string }[]> {
  const results = await Promise.all(
    chars.map(async (char) => {
      try {
        const wordResults = await searchWord(char, charSet);
        // Get the first meaning if available
        const meaning = wordResults.length > 0 ? wordResults[0].meaning : '';
        return { char, meaning };
      } catch (error) {
        console.error(`Failed to lookup character ${char}:`, error);
        return { char, meaning: '' };
      }
    }),
  );
  return results;
}
