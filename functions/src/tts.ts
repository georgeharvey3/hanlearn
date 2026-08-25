import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';
import { internalError, withErrorReporting } from './reporting';

/**
 * Cloud Function that proxies Google Cloud Text-to-Speech API requests.
 * Returns high-quality Mandarin audio as base64-encoded MP3.
 */
export const textToSpeech = functions.https.onCall(
  withErrorReporting('textToSpeech', async (data: { text: string; speed?: number }, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication required'
      );
    }

    const uid = context.auth.uid;
    await checkRateLimit(uid, 'textToSpeech', RATE_LIMITS.textToSpeech);

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
      const accessToken = await admin.credential
        .applicationDefault()
        .getAccessToken();

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

      const response = await fetch(
        'https://texttospeech.googleapis.com/v1/text:synthesize',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.access_token}`,
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

      return { audioContent: result.audioContent };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error('TTS error:', error);
      throw internalError('Text-to-speech synthesis failed', error);
    }
  })
);
