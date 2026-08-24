import * as fs from 'fs';
import * as path from 'path';
import * as functions from 'firebase-functions';
import * as hanziDecomposer from 'hanzi/lib/hanzidecomposer.js';
import { checkRateLimit, RATE_LIMITS } from './rateLimit';

/**
 * Verify that the request is from an authenticated user
 */
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return context.auth.uid;
}

interface CharDefinition {
  pinyin: string;
  meaning: string;
}

interface DecompositionComponent {
  char: string;
  meaning: string | null;
  pinyin: string | null;
}

// In-memory state (persists across warm invocations)
let decomposerReady = false;
let charDefinitions: Record<string, CharDefinition> = {};
let charDefinitionsLoaded = false;

/**
 * Load the decomposition database.
 *
 * This uses the HanziJS decomposer directly instead of `hanzi.start()`.
 * The full `hanzi.start()` also loads CC-CEDICT and two frequency lists,
 * which this function does not use. Measured on Node 20: the decomposer
 * alone needs about 320 ms and 123 MB, while `hanzi.start()` needs about
 * 1500 ms and 294 MB. 294 MB is more than the memory limit of the
 * function, so the instance was killed and the client got an error.
 */
function ensureDecomposer(): void {
  if (decomposerReady) return;
  hanziDecomposer.start();
  decomposerReady = true;
}

/**
 * Load the single-character definitions.
 *
 * `migration/build-dictionary.js` writes this file. Decomposition
 * components are always single characters, so this subset (about 850 KB)
 * replaces the full dictionary (about 16 MB).
 */
function ensureCharDefinitions(): void {
  if (charDefinitionsLoaded) return;
  charDefinitionsLoaded = true;

  const definitionsPath = path.join(__dirname, '..', 'data', 'char-definitions.json');

  try {
    charDefinitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf8'));
  } catch (err) {
    // The function still returns components without meanings if the file
    // is absent, for example in a local emulator that did not run the
    // dictionary build.
    console.error('char-definitions.json could not be loaded:', err);
    charDefinitions = {};
  }
}

function describeComponent(component: string): DecompositionComponent {
  let meaning: string | null = null;
  let pinyin: string | null = null;

  try {
    const radicalMeaning = hanziDecomposer.getRadicalMeaning(component);
    if (radicalMeaning && radicalMeaning !== 'N/A') {
      meaning = radicalMeaning;
    }
  } catch {
    // Radical lookup can fail for unusual components
  }

  const entry = charDefinitions[component];
  if (entry) {
    if (!meaning && entry.meaning) {
      meaning = entry.meaning.split('/')[0];
    }
    if (entry.pinyin) {
      pinyin = entry.pinyin;
    }
  }

  return { char: component, meaning, pinyin };
}

/**
 * Decompose a Chinese character into its radical/structural components.
 * Uses HanziJS for radical-level decomposition with meanings.
 *
 * The memory limit is 512 MB because the decomposition database needs
 * more than the default 256 MB. On Cloud Functions the CPU share also
 * scales with the memory limit, so this makes the first call faster.
 */
export const decomposeCharacter = functions
  .runWith({ memory: '512MB', timeoutSeconds: 30 })
  .https.onCall(async (data: { char: string }, context) => {
    try {
      const uid = verifyAuth(context);

      const { char } = data;

      if (!char || [...char].length !== 1) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'A single Chinese character is required'
        );
      }

      await checkRateLimit(uid, 'decomposeCharacter', RATE_LIMITS.decomposeCharacter);

      ensureDecomposer();
      ensureCharDefinitions();

      let components: DecompositionComponent[];

      try {
        const result = hanziDecomposer.decompose(char, 1);

        // decompose can return the string 'Invalid Input' for unknown chars
        if (!result || typeof result === 'string') {
          return { components: [] };
        }

        const rawComponents: string[] = Array.isArray(result.components)
          ? result.components
          : [];

        // Filter out the character itself, placeholder values, empty strings,
        // and raw Unicode code-point references (e.g. "37045") that appear in
        // CJK decomposition data for obscure stroke components.
        const filtered = rawComponents.filter(
          (c: string) =>
            c &&
            c !== char &&
            c !== 'No glyph available' &&
            c.trim() !== '' &&
            !/^\d+$/.test(c)
        );

        components = filtered.map(describeComponent);
      } catch (err) {
        console.error(`hanzi decomposition failed for "${char}":`, err);
        components = [];
      }

      return { components };
    } catch (err) {
      // Re-throw HttpsErrors as-is so clients get proper error codes
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      console.error('decomposeCharacter unhandled error:', err);
      return { components: [] };
    }
  });
