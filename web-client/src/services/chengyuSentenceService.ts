import { CharSet, toCharSet } from '../utils/charSet';

export interface ChengyuSentence {
  chinese: string;
  pinyin: string;
  english: string;
}

/**
 * The example sentence of a chengyu, in the given character set, or null when
 * the chengyu has none. The sentences are committed in
 * data/chengyuSentences.json, one for each chengyu of data/chengyus.ts, so a
 * sentence needs no AI call and no Firestore read (#387). A Claude Code session
 * wrote them, as ADR 0020 does for the word sentences. A new chengyu needs a
 * sentence there, or the data test fails. The file loads in a chunk of its own,
 * on the first call.
 */
export async function getChengyuExampleSentence(
  chengyu: string,
  charSet: CharSet,
): Promise<ChengyuSentence | null> {
  const { default: sentences } = await import('../data/chengyuSentences.json');
  const sentence = (sentences as Record<string, ChengyuSentence>)[chengyu];
  if (!sentence) return null;
  return { ...sentence, chinese: await toCharSet(sentence.chinese, charSet) };
}
