import { getGenerativeModel } from 'firebase/ai';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Converter } from 'opencc-js';

import { ai, db } from '../firebase/config';

const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });
const toTraditional = Converter({ from: 'cn', to: 'tw' });

interface SentenceExample {
  chinese: string;
  english: string;
  segments: string[];
  targetIndex: number;
}

// Fixed sentences for demo/tryout words — bypasses Firestore and AI entirely.
const DEMO_SENTENCES: Record<string, SentenceExample[]> = {
  你好: [
    {
      chinese: '你好，欢迎来到这里！',
      english: 'Hello, welcome here!',
      segments: ['你好', '欢迎', '来到', '这里'],
      targetIndex: 0,
    },
    {
      chinese: '请向他们说声你好。',
      english: 'Please say hello to them.',
      segments: ['请', '向', '他们', '说声', '你好'],
      targetIndex: 4,
    },
    {
      chinese: '她走进来时说了你好。',
      english: 'She said hello when she came in.',
      segments: ['她', '走进来', '时', '说了', '你好'],
      targetIndex: 4,
    },
    {
      chinese: '老师对每位学生说你好。',
      english: 'The teacher said hello to every student.',
      segments: ['老师', '对', '每位', '学生', '说', '你好'],
      targetIndex: 5,
    },
  ],
};

export interface SegmentedSentenceResult {
  sentence: {
    chinese: {
      sentence: string;
      highlight: number[][];
      segments: string[];
      targetIndex: number;
    };
    english: {
      sentence: string;
      highlight: number[][];
    };
  } | null;
  totalCount: number;
}

const SENTENCES_PER_WORD = 5;

function calculateHighlightIndices(sentence: string, word: string): number[][] {
  const indices: number[][] = [];
  let startIndex = 0;
  while (true) {
    const index = sentence.indexOf(word, startIndex);
    if (index === -1) break;
    indices.push([index, index + word.length]);
    startIndex = index + word.length;
  }
  return indices;
}

async function generateSentencesWithAI(word: string): Promise<SentenceExample[]> {
  const prompt = `You are helping a Chinese language learner with spaced repetition.
Generate exactly ${SENTENCES_PER_WORD} short, natural Chinese sentences (15–30 characters each) that each contain the word "${word}". Use Simplified Chinese characters.

Return ONLY a JSON array in this exact format:
[{"chinese": "...", "english": "...", "segments": ["word1", "word2", ...], "targetIndex": 0}, ...]

Requirements:
- Each sentence MUST contain "${word}" as a complete word
- Consider the HSK level of the target word. Try not to use words in the sentence which are significantly harder than the target word
- segments should split the sentence into natural Chinese words (Chinese characters only, no punctuation)
- targetIndex is the 0-based position of "${word}" in the segments array
- Keep sentences concise and natural
- Vary the contexts and sentence structures
- Provide accurate English translations`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  const text = result.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('AI returned invalid JSON for sentence generation:', text.slice(0, 200));
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return (
    parsed as Array<{
      chinese?: unknown;
      english?: unknown;
      segments?: unknown;
      targetIndex?: unknown;
    }>
  )
    .filter(
      (item) =>
        typeof item.chinese === 'string' &&
        typeof item.english === 'string' &&
        Array.isArray(item.segments) &&
        typeof item.targetIndex === 'number' &&
        item.chinese.includes(word),
    )
    .map((item) => ({
      chinese: item.chinese as string,
      english: item.english as string,
      segments: item.segments as string[],
      targetIndex: item.targetIndex as number,
    }))
    .slice(0, SENTENCES_PER_WORD);
}

async function getOrGenerateSentences(word: string): Promise<SentenceExample[]> {
  if (DEMO_SENTENCES[word]) {
    return DEMO_SENTENCES[word];
  }

  const cacheRef = doc(db, 'sentenceCache', word);

  try {
    const cached = await getDoc(cacheRef);
    if (cached.exists()) {
      return cached.data().sentences as SentenceExample[];
    }
  } catch {
    // Cache read unavailable (e.g. unauthenticated demo user) — fall through to AI
  }

  const sentences = await generateSentencesWithAI(word);

  if (sentences.length > 0) {
    try {
      await setDoc(cacheRef, { sentences, generatedAt: serverTimestamp() });
    } catch {
      // Cache write failed (e.g. unauthenticated) — not critical
    }
  }

  return sentences;
}

export async function getSegmentedSentence(
  word: string,
  charSet: 'simp' | 'trad',
  offset: number,
): Promise<SegmentedSentenceResult> {
  const examples = await getOrGenerateSentences(word);

  if (offset >= examples.length) {
    return { sentence: null, totalCount: examples.length };
  }

  const example = examples[offset];
  const convertedWord = charSet === 'trad' ? toTraditional(word) : word;
  const convertedChinese = charSet === 'trad' ? toTraditional(example.chinese) : example.chinese;
  const convertedSegments = example.segments.map((seg) =>
    charSet === 'trad' ? toTraditional(seg) : seg,
  );
  const highlight = calculateHighlightIndices(convertedChinese, convertedWord);

  return {
    sentence: {
      chinese: {
        sentence: convertedChinese,
        highlight,
        segments: convertedSegments,
        targetIndex: example.targetIndex,
      },
      english: {
        sentence: example.english,
        highlight: [],
      },
    },
    totalCount: examples.length,
  };
}

export async function getHintSentence(
  word: string,
): Promise<{ chinese: string; english: string } | null> {
  const examples = await getOrGenerateSentences(word);
  if (examples.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * examples.length);
  const selected = examples[randomIndex];
  return { chinese: selected.chinese, english: selected.english };
}

export async function checkSentenceAvailability(
  word: string,
  charSet: 'simp' | 'trad',
): Promise<boolean> {
  const result = await getSegmentedSentence(word, charSet, 0);
  return result.sentence !== null;
}
