import * as functions from 'firebase-functions';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';

// Import admin from the already-initialized instance in index.ts
import * as admin from 'firebase-admin';

interface ScoringRequest {
  userText: string;
  referenceText: string;
  language: 'en' | 'zh';
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Rescale raw cosine similarity (typically 0.5–1.0 for natural language) to 0–100.
 */
function rescaleScore(raw: number): number {
  return Math.round(Math.max(0, Math.min(100, ((raw - 0.5) / 0.5) * 100)));
}

/**
 * Get embeddings from Vertex AI text embedding API.
 */
async function getEmbeddings(
  texts: string[],
  model: string,
  projectId: string,
  location: string,
): Promise<number[][]> {
  const accessToken = await admin.credential.applicationDefault().getAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: texts.map(text => ({ content: text })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex AI embedding request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.predictions.map((p: { embeddings: { values: number[] } }) => p.embeddings.values);
}

/**
 * Verify that the request is from an authenticated user.
 */
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication required'
    );
  }
  return context.auth.uid;
}

/**
 * Cloud Function: scoreSimilarity
 *
 * Computes cosine similarity between user's translation and a reference sentence
 * using Vertex AI text embeddings. Returns a 0–100 rescaled score.
 */
export const scoreSimilarity = functions.https.onCall(
  async (data: ScoringRequest, context) => {
    const uid = verifyAuth(context);
    await checkRateLimit(uid, 'scoreSimilarity', RATE_LIMITS.scoreSimilarity);

    const { userText, referenceText, language } = data;

    // Input validation
    if (!userText || typeof userText !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userText is required and must be a string'
      );
    }

    if (!referenceText || typeof referenceText !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'referenceText is required and must be a string'
      );
    }

    if (userText.length > 500 || referenceText.length > 500) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Text inputs must be 500 characters or fewer'
      );
    }

    if (language !== 'en' && language !== 'zh') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'language must be "en" or "zh"'
      );
    }

    // Select the appropriate embedding model
    const model = language === 'en'
      ? 'text-embedding-005'
      : 'text-multilingual-embedding-002';

    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
    const location = 'us-central1';

    try {
      const embeddings = await getEmbeddings(
        [userText, referenceText],
        model,
        projectId,
        location,
      );

      const rawSimilarity = cosineSimilarity(embeddings[0], embeddings[1]);
      const score = rescaleScore(rawSimilarity);

      return { score, rawSimilarity };
    } catch (error) {
      console.error('Error computing similarity:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Failed to compute similarity score'
      );
    }
  }
);
