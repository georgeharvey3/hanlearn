// PROTOTYPE (#405): the data, sample data, in-memory word bank and strings that
// the three word bank variants share. Nothing here writes to Firestore: every
// add, move, edit and delete changes a copy of the words held in React state.
// Throwaway; lives on the prototype/word-bank-405 branch only.
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, levelInk } from '../../../theme';
import { DIRECTIONS, Word, WordList } from '../../../types/models';
import { isNewWord, leechDirections, makeDirections } from '../../../utils/directions';
import { BANK_LABELS } from '../../../utils/scheduling';
import { formatRelativeDueDate } from '../../../utils/formatRelativeDueDate';

export const ALL_LISTS = '__all__';

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

/** What a variant gets: the bank as it stands, and the actions on it. */
export interface BankProps {
  words: Word[];
  lists: WordList[];
  activeListId: string;
  charSet: 'simp' | 'trad';
  query: string;
  results: Word[];
  status: SearchStatus;
  setQuery: (q: string) => void;
  /** Run the search now (Enter). A typed query also searches after a pause. */
  submit: () => void;
  clearSearch: () => void;
  isInBank: (w: Word) => boolean;
  addWord: (w: Word, meaning?: string) => void;
  addCustom: (text: string, meaning: string) => void;
  deleteWord: (id: number) => void;
  setMeaning: (id: number, meaning: string) => void;
  moveWord: (id: number, listId: string) => void;
  switchList: (id: string) => void;
  createList: (name: string) => void;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  onStudy: () => void;
  speak: (text: string) => void;
  /** The last thing that happened, for a toast. */
  toast: string;
  clearToast: () => void;
}

// ---------------------------------------------------------------- the rule

/**
 * A word due within this many days never shows its pinyin or meaning on the
 * word bank. Seeing a word just before the test asks it primes the answer,
 * and the scheduler then records a recall that was not real. A new word is
 * exempt: the learner just added it, and the introduction shows it anyway.
 */
export const HIDE_WITHIN_DAYS = 2;

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysUntil = (w: Word, now = new Date()): number => {
  if (!w.due_date) return 999;
  const [y, m, d] = w.due_date.replace(/\//g, '-').split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfDay(now).getTime()) / DAY);
};

export const isHidden = (w: Word): boolean => !isNewWord(w) && daysUntil(w) < HIDE_WITHIN_DAYS;

export const levelOf = (w: Word): number => w.level ?? 1;
export const levelName = (n: number): string => BANK_LABELS[n] ?? BANK_LABELS[1];
export const levelColor = (n: number): string => levelInk[Math.max(0, Math.min(4, n - 1))];
export const isLeechWord = (w: Word): boolean => leechDirections(w).length > 0;
export const dueText = (w: Word): string => (w.due_date ? formatRelativeDueDate(w.due_date) : '');
export const meaningOf = (w: Word): string => w.ammended_meaning || w.meaning;

// ---------------------------------------------------------------- strings

export const protoCopy = {
  title: 'Word bank',
  searchPlaceholder: 'Search 中文, pinyin or English',
  search: 'Search',
  clear: 'Clear',
  add: 'Add',
  added: 'Added',
  inBank: 'In your bank',
  searching: 'Searching…',
  searchFailed: 'Search failed. Check the connection.',
  noResult: (q: string) => `No entry for ${q}`,
  addCustom: 'Add as your own word',
  meaningLabel: 'Meaning',
  results: (n: number) => `${n} result${n === 1 ? '' : 's'}`,
  words: (n: number) => `${n} word${n === 1 ? '' : 's'}`,
  due: (n: number) => `${n} due`,
  dueSoon: 'Due soon',
  dueSoonCount: (n: number) => `${n} due soon`,
  hiddenNote: 'Hidden until the test',
  show: 'Show',
  allLists: 'All lists',
  lists: 'Lists',
  newList: 'New list',
  listName: 'List name',
  create: 'Create',
  rename: 'Rename',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  move: 'Move',
  moveTo: 'Move to',
  remove: 'Remove',
  edit: 'Edit',
  play: 'Play',
  study: 'Study',
  studyDue: (n: number) => `Study · ${n} due`,
  leech: 'Hard to recall',
  leeches: 'Hard',
  all: 'All',
  sortRecent: 'Recent',
  sortAZ: 'A–Z',
  sortLevel: 'Level',
  deleteListTitle: (name: string) => `Delete ${name}?`,
  deleteListBody: (n: number) => `Its ${n} word${n === 1 ? '' : 's'} go too.`,
  emptyTitle: 'No words yet',
  emptyList: 'This list is empty',
  emptyHint: 'Search to add your first word.',
  try: 'Try',
  noMatch: 'No word in the bank matches',
  toastAdded: (c: string) => `Added ${c}`,
  toastRemoved: (c: string) => `Removed ${c}`,
  toastMoved: (c: string, l: string) => `Moved ${c} to ${l}`,
  toastSaved: 'Meaning saved',
  toastList: (l: string) => `Created ${l}`,
  more: 'More',
  close: 'Close',
};

export const SUGGESTIONS = ['你好', '朋友', '学习'];

// ---------------------------------------------------------------- sample data

const ymd = (offset: number): string => {
  const d = new Date(Date.now() + offset * DAY);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

let nextId = 9000;

const mk = (
  simp: string,
  trad: string,
  pinyin: string,
  meaning: string,
  level: number,
  dueIn: number,
  listId = 'default',
  lapses = 0,
): Word => {
  const directions = makeDirections(level, ymd(dueIn));
  if (lapses) directions.MC = { ...directions.MC, lapses };
  return {
    id: nextId++,
    simp,
    trad,
    pinyin,
    meaning,
    level,
    due_date: ymd(dueIn),
    listId,
    directions,
  };
};

export const sampleLists = (): WordList[] => [
  { id: 'default', name: 'My words', createdAt: '2025-01-01', order: 0 },
  { id: 'hsk3', name: 'HSK 3', createdAt: '2025-03-01', order: 1 },
  { id: 'travel', name: 'Travel', createdAt: '2025-06-01', order: 2 },
];

export const sampleWords = (): Word[] => [
  mk('天气', '天氣', 'tiān qì', 'weather', 1, 0),
  mk('电脑', '電腦', 'diàn nǎo', 'computer', 1, 0),
  mk('认识', '認識', 'rèn shi', 'to know; to recognise', 2, 0),
  mk('觉得', '覺得', 'jué de', 'to think; to feel', 2, 1),
  mk('已经', '已經', 'yǐ jīng', 'already', 3, 5, 'default', 9),
  mk('附近', '附近', 'fù jìn', 'nearby', 3, 4),
  mk('环境', '環境', 'huán jìng', 'environment', 3, 9),
  mk('经验', '經驗', 'jīng yàn', 'experience', 4, 21),
  mk('朋友', '朋友', 'péng you', 'friend', 5, 80),
  mk('学习', '學習', 'xué xí', 'to study; to learn', 5, 120),
  mk('图书馆', '圖書館', 'tú shū guǎn', 'library', 4, 35),
  mk('讨论', '討論', 'tǎo lùn', 'to discuss', 2, 3),
  mk('解决', '解決', 'jiě jué', 'to solve; to settle', 3, 0, 'hsk3', 8),
  mk('检查', '檢查', 'jiǎn chá', 'to check; inspection', 2, 2, 'hsk3'),
  mk('简单', '簡單', 'jiǎn dān', 'simple', 4, 40, 'hsk3'),
  mk('关心', '關心', 'guān xīn', 'to care about', 3, 12, 'hsk3'),
  mk('满意', '滿意', 'mǎn yì', 'satisfied', 2, 1, 'hsk3'),
  mk('护照', '護照', 'hù zhào', 'passport', 3, 6, 'travel'),
  mk('机场', '機場', 'jī chǎng', 'airport', 5, 70, 'travel'),
  mk('行李', '行李', 'xíng li', 'luggage', 2, 0, 'travel'),
  mk('一路平安', '一路平安', 'yí lù píng ān', 'have a good trip', 1, 0, 'travel'),
];

/** A few dictionary entries, so the sample search works without the network. */
const sampleDictionary = (): Word[] => [
  mk('你好', '你好', 'nǐ hǎo', 'hello; hi', 1, 0),
  mk('朋友', '朋友', 'péng you', 'friend', 1, 0),
  mk('学习', '學習', 'xué xí', 'to study; to learn', 1, 0),
  mk('好', '好', 'hǎo', 'good; well; proper', 1, 0),
  mk('好', '好', 'hào', 'to be fond of; to have a tendency to', 1, 0),
  mk('行', '行', 'xíng', 'to walk; OK; capable', 1, 0),
  mk('行', '行', 'háng', 'row; line; profession', 1, 0),
  mk('银行', '銀行', 'yín háng', 'bank', 1, 0),
  mk('旅行', '旅行', 'lǚ xíng', 'to travel; journey', 1, 0),
];

export const sampleSearch = async (q: string): Promise<Word[]> => {
  await new Promise((r) => setTimeout(r, 350));
  const t = q.trim().toLowerCase();
  if (!t) return [];
  return sampleDictionary().filter(
    (w) =>
      w.simp === t ||
      w.trad === t ||
      (t.length > 1 && (w.simp.includes(t) || w.trad.includes(t))) ||
      w.pinyin.replace(/\s/g, '').includes(t.replace(/\s/g, '')) ||
      w.meaning.toLowerCase().includes(t),
  );
};

// ---------------------------------------------------------------- the bank

interface UseBankArgs {
  initialWords: Word[];
  initialLists: WordList[];
  initialListId: string;
  initialQuery?: string;
  charSet: 'simp' | 'trad';
  search: (q: string) => Promise<Word[]>;
  onStudy: () => void;
  speak: (text: string) => void;
}

/** The whole word bank, in memory. A prototype: reload and it is gone. */
export function useBank(args: UseBankArgs): BankProps {
  const { charSet, search } = args;
  const [words, setWords] = useState<Word[]>(args.initialWords);
  const [lists, setLists] = useState<WordList[]>(args.initialLists);
  const [activeListId, setActiveListId] = useState(args.initialListId);
  const [query, setQueryState] = useState(args.initialQuery ?? '');
  const [results, setResults] = useState<Word[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [toast, setToast] = useState('');
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The live page hands over the real words once they load.
  useEffect(() => setWords(args.initialWords), [args.initialWords]);
  useEffect(() => setLists(args.initialLists), [args.initialLists]);

  const run = useCallback(
    (q: string) => {
      const id = ++seq.current;
      if (!q.trim()) {
        setResults([]);
        setStatus('idle');
        return;
      }
      setStatus('searching');
      search(q.trim())
        .then((r) => {
          if (id !== seq.current) return;
          setResults(r);
          setStatus('done');
        })
        .catch(() => id === seq.current && setStatus('error'));
    },
    [search],
  );

  useEffect(() => {
    if (args.initialQuery) run(args.initialQuery);
    // Only the first query of a preview state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => run(q), 400);
    },
    [run],
  );

  const label = (w: Word) => w[charSet];
  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? id;
  const targetList = activeListId === ALL_LISTS ? 'default' : activeListId;

  const isInBank = useCallback(
    (w: Word) => words.some((x) => x.simp === w.simp && x.pinyin === w.pinyin),
    [words],
  );

  const addWord = (w: Word, meaning?: string) => {
    const word = mk(w.simp, w.trad, w.pinyin, meaning?.trim() || w.meaning, 1, 0, targetList);
    setWords((ws) => [word, ...ws]);
    setToast(protoCopy.toastAdded(label(w)));
  };

  return {
    words,
    lists,
    activeListId,
    charSet,
    query,
    results,
    status,
    setQuery,
    submit: () => {
      if (timer.current) clearTimeout(timer.current);
      run(query);
    },
    clearSearch: () => {
      if (timer.current) clearTimeout(timer.current);
      seq.current++;
      setQueryState('');
      setResults([]);
      setStatus('idle');
    },
    isInBank,
    addWord,
    addCustom: (text, meaning) =>
      addWord({ ...mk(text, text, '—', meaning, 1, 0), pinyin: '' }, meaning),
    deleteWord: (id) => {
      const w = words.find((x) => x.id === id);
      setWords((ws) => ws.filter((x) => x.id !== id));
      if (w) setToast(protoCopy.toastRemoved(label(w)));
    },
    setMeaning: (id, meaning) => {
      setWords((ws) => ws.map((x) => (x.id === id ? { ...x, ammended_meaning: meaning } : x)));
      setToast(protoCopy.toastSaved);
    },
    moveWord: (id, listId) => {
      const w = words.find((x) => x.id === id);
      setWords((ws) => ws.map((x) => (x.id === id ? { ...x, listId } : x)));
      if (w) setToast(protoCopy.toastMoved(label(w), listName(listId)));
    },
    switchList: setActiveListId,
    createList: (name) => {
      const id = `list-${Date.now()}`;
      setLists((ls) => [...ls, { id, name, createdAt: '', order: ls.length }]);
      setActiveListId(id);
      setToast(protoCopy.toastList(name));
    },
    renameList: (id, name) => setLists((ls) => ls.map((l) => (l.id === id ? { ...l, name } : l))),
    deleteList: (id) => {
      setLists((ls) => ls.filter((l) => l.id !== id));
      setWords((ws) => ws.filter((w) => (w.listId ?? 'default') !== id));
      setActiveListId('default');
    },
    onStudy: args.onStudy,
    speak: args.speak,
    toast,
    clearToast: () => setToast(''),
  };
}

// ---------------------------------------------------------------- helpers

export const inList = (w: Word, listId: string): boolean =>
  listId === ALL_LISTS || (w.listId ?? 'default') === listId;

export const wordsOf = (b: Pick<BankProps, 'words' | 'activeListId'>): Word[] =>
  b.words.filter((w) => inList(w, b.activeListId));

/** Due today or before: what Study would ask now. */
export const dueCount = (ws: Word[]): number => ws.filter((w) => daysUntil(w) <= 0).length;

export const activeListName = (b: Pick<BankProps, 'lists' | 'activeListId'>): string =>
  b.activeListId === ALL_LISTS
    ? protoCopy.allLists
    : (b.lists.find((l) => l.id === b.activeListId)?.name ?? '');

/** Matches a bank word against the search text, for filtering the bank. */
export const matchesBank = (w: Word, q: string): boolean => {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    w.simp.includes(t) ||
    w.trad.includes(t) ||
    w.pinyin.replace(/\s/g, '').includes(t.replace(/\s/g, '')) ||
    meaningOf(w).toLowerCase().includes(t)
  );
};

export const directionsLabel = DIRECTIONS;
export { colors };

/** Room at the foot of each variant for the prototype bar. */
export const SWITCHER_GAP = 72;
