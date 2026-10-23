// PROTOTYPE (#403): the word-level helpers behind variants D to G, which show
// the learner's own words rather than counts. Throwaway.
import { DIRECTIONS, Direction, Word } from '../../../types/models';

const DAY = 86400000;

export const startOfDay = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** The word's due day, local midnight. Undefined counts as due now. */
export const dueDay = (w: Word): Date => {
  if (!w.due_date) return startOfDay(new Date());
  const [y, m, d] = w.due_date.replace(/\//g, '-').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return startOfDay(new Date());
  return new Date(y, m - 1, d);
};

export const isDue = (w: Word, now = new Date()): boolean => dueDay(w) <= startOfDay(now);

/** Days from today: 0 is today (and anything overdue). */
export const daysUntil = (w: Word, now = new Date()): number =>
  Math.max(0, Math.round((dueDay(w).getTime() - startOfDay(now).getTime()) / DAY));

/**
 * A word due within this many days never shows its characters on the
 * Dashboard. Seeing a word just before the test asks it primes the answer,
 * and the scheduler then reads a recall that was not real.
 */
export const HIDE_WITHIN_DAYS = 2;

export const isHidden = (w: Word, now = new Date()): boolean =>
  daysUntil(w, now) < HIDE_WITHIN_DAYS;

export const levelOf = (w: Word): number => w.level ?? 1;

export const lapsesOf = (w: Word): number =>
  DIRECTIONS.reduce((s, d) => s + (w.directions?.[d]?.lapses ?? 0), 0);

/** The direction with the most lapses, or the lowest level. */
export const weakestDirectionOf = (w: Word): Direction =>
  [...DIRECTIONS].sort((a, b) => {
    const la = w.directions?.[a];
    const lb = w.directions?.[b];
    return (lb?.lapses ?? 0) - (la?.lapses ?? 0) || (la?.level ?? 1) - (lb?.level ?? 1);
  })[0];

/** The share of words at level 3 or above, per direction. */
export const strengthByDirection = (words: Word[]): Record<Direction, number> =>
  DIRECTIONS.reduce(
    (acc, d) => {
      const strong = words.filter((w) => (w.directions?.[d]?.level ?? levelOf(w)) >= 3).length;
      acc[d] = words.length ? strong / words.length : 0;
      return acc;
    },
    {} as Record<Direction, number>,
  );

/** The count of words due on each of the next `days` days; index 0 holds overdue too. */
export const loadAhead = (words: Word[], days = 7): number[] => {
  const out = Array.from({ length: days }, () => 0);
  for (const w of words) {
    const n = daysUntil(w);
    if (n < days) out[n] += 1;
  }
  return out;
};

const iso = (offsetDays: number): string => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// [simp, trad, numbered pinyin, meaning, level, due in days, lapses on CM]
const RAW: [string, string, string, string, number, number, number][] = [
  ['了解', '了解', 'liao3 jie3', 'to understand', 2, 0, 3],
  ['已经', '已經', 'yi3 jing1', 'already', 4, 12, 0],
  ['认为', '認為', 'ren4 wei2', 'to think, to believe', 3, 0, 1],
  ['环境', '環境', 'huan2 jing4', 'environment', 1, 0, 9],
  ['经验', '經驗', 'jing1 yan4', 'experience', 2, 0, 2],
  ['机会', '機會', 'ji1 hui4', 'opportunity', 3, 2, 0],
  ['危险', '危險', 'wei1 xian3', 'danger', 1, 3, 8],
  ['旅游', '旅遊', 'lü3 you2', 'to travel', 5, 64, 0],
  ['安静', '安靜', 'an1 jing4', 'quiet', 4, 30, 0],
  ['决定', '決定', 'jue2 ding4', 'to decide', 2, 0, 4],
  ['习惯', '習慣', 'xi2 guan4', 'habit', 3, 1, 1],
  ['邻居', '鄰居', 'lin2 ju1', 'neighbour', 1, 0, 5],
  ['简单', '簡單', 'jian3 dan1', 'simple', 5, 90, 0],
  ['重要', '重要', 'zhong4 yao4', 'important', 5, 70, 0],
  ['感冒', '感冒', 'gan3 mao4', 'to catch a cold', 3, 3, 0],
  ['礼物', '禮物', 'li3 wu4', 'gift', 4, 20, 0],
  ['影响', '影響', 'ying3 xiang3', 'influence', 1, 4, 10],
  ['选择', '選擇', 'xuan3 ze2', 'to choose', 2, 0, 2],
  ['满意', '滿意', 'man3 yi4', 'satisfied', 3, 4, 0],
  ['检查', '檢查', 'jian3 cha2', 'to inspect', 2, 1, 1],
  ['节目', '節目', 'jie2 mu4', 'programme', 4, 25, 0],
  ['发现', '發現', 'fa1 xian4', 'to discover', 3, 0, 1],
  ['担心', '擔心', 'dan1 xin1', 'to worry', 4, 40, 0],
  ['准备', '準備', 'zhun3 bei4', 'to prepare', 5, 120, 0],
  ['努力', '努力', 'nu3 li4', 'to strive', 5, 80, 0],
  ['解释', '解釋', 'jie3 shi4', 'to explain', 1, 2, 6],
  ['参加', '參加', 'can1 jia1', 'to take part', 3, 2, 0],
  ['空调', '空調', 'kong1 tiao2', 'air conditioner', 2, 3, 0],
  ['比赛', '比賽', 'bi3 sai4', 'competition', 4, 15, 0],
  ['健康', '健康', 'jian4 kang1', 'healthy', 5, 100, 0],
  ['熊猫', '熊貓', 'xiong2 mao1', 'panda', 5, 150, 0],
  ['刷牙', '刷牙', 'shua1 ya2', 'to brush teeth', 3, 5, 0],
  ['灯', '燈', 'deng1', 'lamp', 4, 33, 0],
  ['爱好', '愛好', 'ai4 hao4', 'hobby', 5, 60, 0],
  ['终于', '終於', 'zhong1 yu2', 'at last', 2, 0, 2],
  ['春', '春', 'chun1', 'spring', 4, 18, 0],
  ['甜', '甜', 'tian2', 'sweet', 3, 6, 0],
  ['聪明', '聰明', 'cong1 ming2', 'clever', 2, 1, 0],
  ['照顾', '照顧', 'zhao4 gu4', 'to look after', 1, 0, 3],
  ['提高', '提高', 'ti2 gao1', 'to raise', 3, 0, 0],
  ['世界', '世界', 'shi4 jie4', 'world', 5, 75, 0],
  ['认真', '認真', 'ren4 zhen1', 'conscientious', 2, 2, 1],
  ['历史', '歷史', 'li4 shi3', 'history', 4, 28, 0],
  ['游戏', '遊戲', 'you2 xi4', 'game', 3, 0, 0],
  ['结束', '結束', 'jie2 shu4', 'to finish', 2, 0, 1],
  ['新闻', '新聞', 'xin1 wen2', 'news', 4, 22, 0],
  ['花园', '花園', 'hua1 yuan2', 'garden', 1, 0, 0],
  ['鼻子', '鼻子', 'bi2 zi', 'nose', 2, 4, 0],
];

/** A believable collection for an account with no words, so the variants can be judged. */
export const sampleWords: Word[] = RAW.map(
  ([simp, trad, pinyin, meaning, level, due, lapses], i) => ({
    id: 9000 + i,
    simp,
    trad,
    pinyin,
    meaning,
    level,
    due_date: iso(due),
    directions: DIRECTIONS.reduce(
      (acc, d, j) => {
        // Spread the strength so the five directions differ: CM is the weakest.
        const dl = Math.max(
          1,
          Math.min(
            5,
            level + (d === 'MC' ? 1 : 0) - (d === 'CM' ? 1 : 0) + ((i + j) % 3 === 0 ? 1 : 0),
          ),
        );
        acc[d] = {
          level: Math.max(level, d === 'CM' ? level : dl),
          dueDate: iso(due),
          lapses: d === 'CM' ? lapses : Math.floor(lapses / 3),
        };
        return acc;
      },
      {} as NonNullable<Word['directions']>,
    ),
  }),
);
