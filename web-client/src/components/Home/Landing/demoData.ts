// The words the landing page's demos play with. They stand for a learner's
// own words, so they are data, not copy.

export type DemoCard =
  | { kind: 'flash'; q: string; answer: string; pinyin: string; due: string }
  | { kind: 'type'; q: string; answer: string; demo: string; due: string }
  | { kind: 'write'; q: string; answer: string; pinyin: string; due: string };

/** The hero phone's session. */
export const phoneCards: DemoCard[] = [
  { kind: 'flash', q: '学习', answer: 'to study', pinyin: 'xuéxí', due: '4 days' },
  { kind: 'type', q: '电脑', answer: 'diànnǎo', demo: 'dian4nao3', due: '6 days' },
  { kind: 'write', q: 'good', answer: '好', pinyin: 'hǎo', due: '3 days' },
];

/** When a missed card comes back. */
export const missedDue = '1 day';

/** The word the five-ways section asks in each direction. */
export const fiveWaysWord = { char: '学习', pinyin: 'xuéxí', meaning: 'to study' };

/** The small demos in the features section. */
export const featureDemos = {
  query: 'xuexi',
  result: { char: '学习', pinyin: 'xuéxí', meaning: 'to study' },
  breakdown: {
    char: '明',
    meaning: 'bright',
    parts: [
      { char: '日', pinyin: 'rì', meaning: 'sun' },
      { char: '月', pinyin: 'yuè', meaning: 'moon' },
    ],
  },
  sentence: ['我', '每天', '学习', '中文', '。'],
  sentenceWord: 2,
  sentenceGloss: 'I study Chinese every day.',
  chengyu: {
    chars: '画蛇添足',
    pinyin: 'huà shé tiān zú',
    options: ['A narrow escape', 'Overdo it', 'Work in vain'],
    correct: 1,
    // The option the demo taps first, and gets wrong.
    miss: 0,
  },
};
