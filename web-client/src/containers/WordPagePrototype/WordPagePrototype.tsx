// PROTOTYPE (#562): three variants of the word page, switchable via
// `?variant=A|B|C`, on the dev-only route /dev/word/:id. `?case=` picks the
// data: `owned` (学习, a leech on CM and an amended meaning), `new` (行 xíng,
// not owned, with other readings), `covered` (owned and due today), `store`
// (the learner's word with the id of the route, when signed in). Throwaway:
// the data is fixtures in memory, and Add writes nothing.
import React, { useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { useSelector } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';

import { RootState } from '../../types/store';
import { DirectionStates, Word } from '../../types/models';
import { readCharSet } from '../../components/Sentences/shared';
import { isCovered, listIdsOf } from '../../utils/wordBank';
import PrototypeSwitcher, { useParam } from '../../components/UI/PrototypeSwitcher/PrototypeSwitcher';
import VariantA, { name as nameA } from './VariantA';
import VariantB, { name as nameB } from './VariantB';
import VariantC, { name as nameC } from './VariantC';
import { PageData } from './parts';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const dirs = (spec: Record<string, [number, number, number?]>): DirectionStates =>
  Object.fromEntries(
    Object.entries(spec).map(([k, [level, due, lapses]]) => [k, { level, dueDate: day(due), lapses }]),
  ) as unknown as DirectionStates;

const XUEXI: Word = {
  id: 9001,
  simp: '学习',
  trad: '學習',
  pinyin: 'xué xí',
  meaning: 'to learn/to study',
  ammended_meaning: 'to study (a subject)',
  level: 2,
  due_date: day(4),
  listIds: ['l1', 'l2'],
  directions: dirs({ MC: [4, 34], MP: [3, 12, 1], PM: [3, 9], PC: [2, 4, 2], CM: [2, 5, 9] }),
};

const XING: Word = {
  id: 9002,
  simp: '行',
  trad: '行',
  pinyin: 'xíng',
  meaning:
    'to walk/to go/to travel/a visit/temporary/makeshift/current/in circulation/to do/to perform/capable/competent/OK/all right/will do/behavior/conduct',
};
const HANG: Word = { id: 9003, simp: '行', trad: '行', pinyin: 'háng', meaning: 'row/line/trade/profession' };
const HENG: Word = { id: 9004, simp: '行', trad: '行', pinyin: 'hèng', meaning: 'see 道行[dao4 heng2]' };

const COVERED: Word = { ...XUEXI, id: 9005, simp: '图书馆', trad: '圖書館', pinyin: 'tú shū guǎn', meaning: 'library/CL:家[jia1],個|个[ge4]', ammended_meaning: undefined, due_date: day(0) };

const VARIANTS = [
  { key: 'A', name: nameA, C: VariantA },
  { key: 'B', name: nameB, C: VariantB },
  { key: 'C', name: nameC, C: VariantC },
];
const CASES = ['owned', 'new', 'covered', 'store'];

const WordPagePrototype: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const variant = useParam('variant', 'A');
  const kase = useParam('case', 'owned');
  const charSet = readCharSet();
  const storeWords = useSelector((s: RootState) => s.addWords.words);
  const lists = useSelector((s: RootState) => s.addWords.lists);
  // The cover lifts for the page, as the "shown" flag of the word row does.
  const [shown, setShown] = useState(false);
  // Add writes nothing here: it only moves the page to the owned state.
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [readingId, setReadingId] = useState<number | null>(null);

  const data: PageData = useMemo(() => {
    let entry: Word;
    let owned: Word | null;
    let otherReadings: Word[] = [];
    let listNames = ['HSK 1', 'Daily'];
    if (kase === 'store') {
      const found = storeWords.find((w) => String(w.id) === id) ?? storeWords[0] ?? XUEXI;
      entry = found;
      owned = found;
      listNames = lists.filter((l) => listIdsOf(found).includes(l.id)).map((l) => l.name);
    } else if (kase === 'new') {
      const all = [XING, HANG, HENG];
      entry = all.find((w) => w.id === readingId) ?? XING;
      otherReadings = all.filter((w) => w !== entry);
      owned = addedIds.includes(entry.id)
        ? { ...entry, level: 1, due_date: day(0), listIds: ['l1'], directions: dirs({ MC: [1, 0], MP: [1, 0], PM: [1, 0], PC: [1, 0], CM: [1, 0] }) }
        : null;
      listNames = ['HSK 1'];
    } else if (kase === 'covered') {
      entry = COVERED;
      owned = COVERED;
    } else {
      entry = XUEXI;
      owned = XUEXI;
    }
    return {
      entry,
      owned,
      otherReadings,
      listNames,
      covered: !!owned && isCovered(owned) && !shown,
      charSet,
      onShow: () => setShown(true),
      onAdd: () => setAddedIds((ids) => [...ids, entry.id]),
      onOpenReading: (w) => setReadingId(w.id),
    };
  }, [kase, storeWords, lists, id, readingId, addedIds, shown, charSet]);

  const V = (VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0]).C;
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', px: 2, pb: 16 }}>
      <Box
        component="button"
        onClick={() => history.goBack()}
        sx={{ mt: 1, display: 'block', border: 'none', background: 'none', fontSize: 14, color: 'inherit', p: 0, cursor: 'pointer' }}
      >
        {'← Back'}
      </Box>
      <V key={`${variant}-${kase}-${data.entry.id}`} data={data} />
      <PrototypeSwitcher
        variants={VARIANTS.map(({ key, name }) => ({ key, name }))}
        extra={{ param: 'case', values: CASES }}
      />
    </Box>
  );
};

export default WordPagePrototype;
