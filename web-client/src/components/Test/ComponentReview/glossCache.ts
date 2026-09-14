import { CharacterGloss } from './characterGloss';

/**
 * Dictionary answers live for the session: a character missed in one question
 * is often a character missed in the next, and the lookup is a network call.
 */
const glossCache = new Map<string, CharacterGloss>();

const cacheKeyFor = (char: string, charSet: 'simp' | 'trad'): string => `${charSet}:${char}`;

export const readGloss = (char: string, charSet: 'simp' | 'trad'): CharacterGloss | undefined =>
  glossCache.get(cacheKeyFor(char, charSet));

export const writeGloss = (char: string, charSet: 'simp' | 'trad', gloss: CharacterGloss): void => {
  glossCache.set(cacheKeyFor(char, charSet), gloss);
};

/** Empty the session cache. Tests need each case to start from a cold lookup. */
export const clearCharacterGlossCache = (): void => {
  glossCache.clear();
};
