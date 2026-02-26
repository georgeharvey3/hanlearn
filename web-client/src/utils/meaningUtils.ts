/**
 * Parse a "/"-separated meaning string into an array of individual meanings.
 */
export function parseMeanings(meaning: string): string[] {
  return meaning
    .split('/')
    .flatMap((m) => m.split(';'))
    .map((m) => m.trim())
    .filter((m) => m.length > 0 && !m.startsWith('CL:'));
}

/**
 * Join an array of meanings back into a "/"-separated string for storage.
 */
export function joinMeanings(meanings: string[]): string {
  return meanings.join('/');
}
