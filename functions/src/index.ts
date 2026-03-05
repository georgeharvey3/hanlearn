import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

/**
 * Verify that the request is from an authenticated user
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
 * Get the daily chengyu challenge
 */
export const getDailyChengyu = functions.https.onCall(
  async (data, context) => {
    verifyAuth(context);

    const BASE_DATE = new Date('2021-05-24');
    const today = new Date();
    const daysSinceBase = Math.floor(
      (today.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get all chengyus
    const chengyusSnapshot = await db.collection('chengyus').get();
    interface Chengyu {
      id: string;
      characters: string;
      pinyin: string;
      meaning: string;
    }
    const chengyus: Chengyu[] = chengyusSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Chengyu, 'id'>),
    }));

    if (chengyus.length === 0) {
      return { chengyu: null, options: [], correct: '', char_results: [] };
    }

    // Select today's chengyu
    const index = daysSinceBase % chengyus.length;
    const todaysChengyu = chengyus[index];

    // Get 3 random wrong options
    const otherChengyus = chengyus.filter((_, i) => i !== index);
    const shuffled = otherChengyus.sort(() => Math.random() - 0.5);
    const wrongOptions = shuffled.slice(0, 3).map((c) => c.meaning);

    // Shuffle all options
    const allOptions = [todaysChengyu.meaning, ...wrongOptions].sort(
      () => Math.random() - 0.5
    );

    // Look up character data
    const charResults = [];
    for (const char of todaysChengyu.characters) {
      const wordsSnapshot = await db
        .collection('words')
        .where('simp', '==', char)
        .get();

      const trads: string[] = [];
      const pinyins: string[] = [];
      const meanings: string[] = [];

      wordsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.trad && !trads.includes(data.trad)) trads.push(data.trad);
        if (data.pinyin && !pinyins.includes(data.pinyin))
          pinyins.push(data.pinyin);
        if (data.meaning && !meanings.includes(data.meaning))
          meanings.push(data.meaning);
      });

      charResults.push({
        char,
        trads: trads.slice(0, 10),
        pinyins: pinyins.slice(0, 10),
        meanings: meanings.slice(0, 10),
      });
    }

    return {
      chengyu: todaysChengyu.characters,
      options: allOptions,
      correct: todaysChengyu.meaning,
      char_results: charResults,
    };
  }
);

/**
 * Look up a single character for the chengyu quiz
 */
export const lookupChengyuChar = functions.https.onCall(
  async (data: { char: string }, context) => {
    verifyAuth(context);

    const { char } = data;

    if (!char) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'char is required'
      );
    }

    const wordsSnapshot = await db
      .collection('words')
      .where('simp', '==', char)
      .get();

    const trads: string[] = [];
    const pinyins: string[] = [];
    const meanings: string[] = [];

    wordsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.trad && !trads.includes(data.trad)) trads.push(data.trad);
      if (data.pinyin && !pinyins.includes(data.pinyin))
        pinyins.push(data.pinyin);
      if (data.meaning && !meanings.includes(data.meaning))
        meanings.push(data.meaning);
    });

    return {
      simp: char,
      trads,
      pinyins,
      meanings,
    };
  }
);
