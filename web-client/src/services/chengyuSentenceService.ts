import { getGenerativeModel, GenerativeModel } from 'firebase/ai';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Converter } from 'opencc-js';

import { ai, db } from '../firebase/config';

let _model: GenerativeModel | null = null;
function getModel(): GenerativeModel {
  if (!_model) {
    _model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });
  }
  return _model;
}

let _toTraditional: ((text: string) => string) | null = null;
function getToTraditional(): (text: string) => string {
  if (!_toTraditional) {
    _toTraditional = Converter({ from: 'cn', to: 'tw' });
  }
  return _toTraditional;
}

export interface ChengyuSentence {
  chinese: string;
  pinyin: string;
  english: string;
}

async function generateChengyuSentenceWithAI(chengyu: string): Promise<ChengyuSentence | null> {
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

  const result = await getModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const text = result.response.text();
  const parsed: unknown = JSON.parse(text);

  if (
    parsed &&
    typeof parsed === 'object' &&
    'chinese' in parsed &&
    'pinyin' in parsed &&
    'english' in parsed &&
    typeof (parsed as Record<string, unknown>).chinese === 'string' &&
    typeof (parsed as Record<string, unknown>).pinyin === 'string' &&
    typeof (parsed as Record<string, unknown>).english === 'string'
  ) {
    const obj = parsed as { chinese: string; pinyin: string; english: string };
    if (obj.chinese.includes(chengyu)) {
      return { chinese: obj.chinese, pinyin: obj.pinyin, english: obj.english };
    }
  }

  return null;
}

export async function getChengyuExampleSentence(
  chengyu: string,
  charSet: 'simp' | 'trad',
): Promise<ChengyuSentence | null> {
  const cacheRef = doc(db, 'chengyuSentences', chengyu);

  try {
    const cached = await getDoc(cacheRef);
    if (cached.exists()) {
      const data = cached.data().sentence as ChengyuSentence;
      if (charSet === 'trad') {
        return {
          chinese: getToTraditional()(data.chinese),
          pinyin: data.pinyin,
          english: data.english,
        };
      }
      return data;
    }
  } catch {
    // Cache read unavailable — fall through to AI generation
  }

  let sentence: ChengyuSentence | null;
  try {
    sentence = await generateChengyuSentenceWithAI(chengyu);
  } catch {
    return null;
  }

  if (sentence) {
    try {
      await setDoc(cacheRef, { sentence, generatedAt: serverTimestamp() });
    } catch {
      // Cache write failed — not critical
    }

    if (charSet === 'trad') {
      return {
        chinese: getToTraditional()(sentence.chinese),
        pinyin: sentence.pinyin,
        english: sentence.english,
      };
    }
  }

  return sentence;
}
