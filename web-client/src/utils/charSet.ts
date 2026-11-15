export type CharSet = 'simp' | 'trad';

// opencc-js holds about 1 MB of dictionaries, so it loads on the first
// conversion, in a chunk of its own, and not with each screen that imports this.
let toTraditional: Promise<(text: string) => string> | null = null;

/**
 * Simplified text in the given character set. If the converter does not load
 * (offline), the text stays simplified, and the next call tries again.
 */
export async function toCharSet(text: string, charSet: CharSet): Promise<string> {
  if (charSet === 'simp') return text;
  toTraditional ??= import('opencc-js').then(({ Converter }) =>
    Converter({ from: 'cn', to: 'tw' }),
  );
  try {
    return (await toTraditional)(text);
  } catch {
    toTraditional = null;
    return text;
  }
}
