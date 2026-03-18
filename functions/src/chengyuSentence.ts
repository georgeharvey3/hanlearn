import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { VertexAI } from '@google-cloud/vertexai';

import { checkRateLimit, RATE_LIMITS } from './rateLimit';

const db = admin.firestore();

interface ChengyuSentence {
  chinese: string;
  pinyin: string;
  english: string;
}

function isValidSentence(parsed: unknown, chengyu: string): parsed is ChengyuSentence {
  return (
    parsed !== null &&
    typeof parsed === 'object' &&
    'chinese' in parsed &&
    'pinyin' in parsed &&
    'english' in parsed &&
    typeof (parsed as Record<string, unknown>).chinese === 'string' &&
    typeof (parsed as Record<string, unknown>).pinyin === 'string' &&
    typeof (parsed as Record<string, unknown>).english === 'string' &&
    ((parsed as Record<string, unknown>).chinese as string).includes(chengyu)
  );
}

/**
 * Generate (or retrieve cached) an example sentence for a chengyu.
 * Uses Vertex AI (Gemini) server-side for reliable generation and caches
 * the result in Firestore so subsequent requests are instant.
 */
export const generateChengyuSentence = functions.https.onCall(
  async (data: { chengyu: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required',
      );
    }

    const uid = context.auth.uid;
    await checkRateLimit(uid, 'generateChengyuSentence', RATE_LIMITS.generateChengyuSentence);

    const { chengyu } = data;
    if (!chengyu || typeof chengyu !== 'string' || chengyu.length > 20) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Valid chengyu string is required',
      );
    }

    // Check Firestore cache first
    const cacheRef = db.collection('chengyuSentences').doc(chengyu);
    const cached = await cacheRef.get();
    if (cached.exists) {
      return { sentence: cached.data()?.sentence || null };
    }

    // Generate with Vertex AI
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
    const vertexai = new VertexAI({ project: projectId, location: 'us-central1' });
    const model = vertexai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are helping a Chinese language learner understand the chengyu (成语) "${chengyu}".
Generate ONE short, natural Chinese example sentence (15–30 characters) that uses this chengyu in context. Use Simplified Chinese characters.

Return ONLY a JSON object in this exact format:
{"chinese": "...", "pinyin": "...", "english": "..."}

Requirements:
- The sentence MUST contain "${chengyu}" used naturally in context
- pinyin should be the full pinyin for the entire sentence with tone marks
- english should be a natural English translation
- Keep the sentence concise and natural
- Use a context that illustrates the meaning of the chengyu clearly`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { sentence: null };

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { sentence: null };
    }

    if (isValidSentence(parsed, chengyu)) {
      const sentence: ChengyuSentence = {
        chinese: parsed.chinese,
        pinyin: parsed.pinyin,
        english: parsed.english,
      };

      // Cache in Firestore
      await cacheRef.set({
        sentence,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { sentence };
    }

    return { sentence: null };
  },
);
