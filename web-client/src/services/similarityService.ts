import { getGenerativeModel } from 'firebase/ai';
import { ai } from '../firebase/config';

const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });

interface SimilarityResult {
  score: number;
  rawSimilarity: number;
}

/**
 * Score how similar two sentences are using Gemini.
 *
 * Previously this called a Cloud Function that used Vertex AI embeddings,
 * but that approach required Vertex AI API setup and kept failing (issue #223).
 * Using Gemini directly on the client mirrors the pattern used by
 * sentenceService.ts and avoids the extra infrastructure dependency.
 */
export async function getSimilarityScore(
  userText: string,
  referenceText: string,
  language: 'en' | 'zh',
): Promise<SimilarityResult> {
  const langLabel = language === 'zh' ? 'Chinese' : 'English';

  const prompt = `You are a language learning assistant scoring sentence similarity.

Compare these two ${langLabel} sentences and rate how similar their meaning is on a scale of 0 to 100.

Reference sentence: "${referenceText}"
User's sentence: "${userText}"

Scoring guide:
- 90-100: Nearly identical meaning, minor wording differences
- 70-89: Same core meaning, some details differ
- 50-69: Related meaning but notable differences
- 30-49: Loosely related, significant meaning differences
- 0-29: Very different meanings

Return ONLY a JSON object in this exact format: {"score": <number>}`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const text = result.response.text();
  const parsed = JSON.parse(text) as { score: number };

  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  return { score, rawSimilarity: score / 100 };
}
