import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

interface SimilarityResult {
  score: number;
  rawSimilarity: number;
}

const scoreSimilarityFn = httpsCallable<
  { userText: string; referenceText: string; language: 'en' | 'zh' },
  SimilarityResult
>(functions, 'scoreSimilarity');

export async function getSimilarityScore(
  userText: string,
  referenceText: string,
  language: 'en' | 'zh',
): Promise<SimilarityResult> {
  const result = await scoreSimilarityFn({ userText, referenceText, language });
  return result.data;
}
