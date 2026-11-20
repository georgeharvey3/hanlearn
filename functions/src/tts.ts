import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';
import { internalError, withErrorReporting } from './reporting';
import { cachedAccessToken } from './accessToken';
import { logStructured, stepTimer, StepTimer } from './latency';

// One token for the instance, renewed before it expires (#576).
const getAccessToken = cachedAccessToken(() =>
  admin.credential.applicationDefault().getAccessToken()
);

/**
 * Cloud Function that proxies Google Cloud Text-to-Speech API requests.
 * Returns high-quality Mandarin audio as base64-encoded MP3.
 */
// See functions/src/index.ts for the reasoning behind 256MB, and
// functions/monitoring/README.md for the alert policy that watches it.
export const textToSpeech = functions
  .runWith({ memory: '256MB' })
  .https.onCall(
  withErrorReporting('textToSpeech', async (data: { text: string; speed?: number }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    const uid = context.auth.uid;

    // The handler makes three network calls in sequence. The latency line
    // gives only their sum, so the time of each goes in one more line (#576).
    const timer = stepTimer();
    let tokenCached: boolean | undefined;
    try {
      await timer.time('rateLimit', () =>
        checkRateLimit(uid, 'textToSpeech', RATE_LIMITS.textToSpeech)
      );
      const synthesized = await synthesize(data, timer);
      tokenCached = synthesized.tokenCached;
      return { audioContent: synthesized.audioContent };
    } finally {
      logStructured('tts steps', {
        function: 'textToSpeech',
        steps: timer.steps(),
        tokenCached,
      });
    }
  })
);

async function synthesize(
  data: { text: string; speed?: number },
  timer: StepTimer
): Promise<{ audioContent: string; tokenCached: boolean }> {
  const { text, speed } = data;

  // Validate input
  if (!text || typeof text !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'text is required and must be a string'
    );
  }

  const cleanText = text.replace(/<[^>]*>/g, '').trim();

  if (cleanText.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'text must not be empty'
    );
  }

  if (cleanText.length > 200) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'text must be 200 characters or fewer'
    );
  }

  const speakingRate = typeof speed === 'number'
    ? Math.max(0.25, Math.min(4.0, speed))
    : 1.0;

  try {
    // Use the Google Cloud TTS REST API directly (no extra dependency needed)
    const accessToken = await timer.time('token', getAccessToken);

    const requestBody = {
      input: { text: cleanText },
      voice: {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Wavenet-A',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate,
      },
    };

    // The synthesis step holds the read of the body, which carries the audio.
    return await timer.time('synthesis', async () => {
      const response = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google TTS API error:', response.status, errorText);
        throw internalError(
          'Text-to-speech synthesis failed',
          new Error(
            `Google TTS responded ${response.status}: ${errorText.slice(0, 500)}`
          )
        );
      }

      const result = await response.json() as { audioContent: string };
      return { audioContent: result.audioContent, tokenCached: accessToken.cached };
    });
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('TTS error:', error);
    throw internalError('Text-to-speech synthesis failed', error);
  }
}
