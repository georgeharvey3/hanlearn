// PROTOTYPE (#405): mounts a word bank variant on /add-words. ?variant=A|B|C
// picks the variant; ?state= picks the data. With no ?state= the variant gets
// the learner's real words and the real dictionary, but every change stays in
// memory. Throwaway.
import React, { useMemo } from 'react';
import { Word, WordList } from '../../../types/models';
import * as wordService from '../../../services/wordService';
import * as ttsService from '../../../services/ttsService';
import PrototypeSwitcher from '../../UI/PrototypeSwitcher/PrototypeSwitcher';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';
import { sampleLists, sampleSearch, sampleWords, useBank } from './shared';

export const PROTO_VARIANTS = [
  { key: '', name: 'Current' },
  { key: 'A', name: 'Search first' },
  { key: 'B', name: 'Lists first' },
  { key: 'C', name: 'Character wall' },
];

export const PROTO_STATES = [
  { key: '', name: 'Live' },
  { key: 'sample', name: 'Sample' },
  { key: 'search', name: 'Search' },
  { key: 'noresult', name: 'No result' },
  { key: 'empty', name: 'Empty' },
];

interface Props {
  variant: string;
  state: string;
  liveWords: Word[];
  liveLists: WordList[];
  liveListId: string;
  charSet: 'simp' | 'trad';
  onStudy: () => void;
}

const Variant: React.FC<Props> = ({
  variant,
  state,
  liveWords,
  liveLists,
  liveListId,
  charSet,
  onStudy,
}) => {
  const live = state === '';
  const initial = useMemo(
    () => ({
      words: live ? liveWords : state === 'empty' ? [] : sampleWords(),
      lists: live ? liveLists : sampleLists(),
      listId: live ? liveListId : 'default',
      query: state === 'search' ? '好' : state === 'noresult' ? '囧' : '',
    }),
    [live, liveWords, liveLists, liveListId, state],
  );
  const bank = useBank({
    initialWords: initial.words,
    initialLists: initial.lists,
    initialListId: initial.listId,
    initialQuery: initial.query,
    charSet,
    search: live ? (q) => wordService.searchWord(q, charSet) : sampleSearch,
    onStudy,
    speak: (t) => ttsService.speak(t),
  });
  if (variant === 'A') return <VariantA bank={bank} />;
  if (variant === 'B') return <VariantB bank={bank} />;
  return <VariantC bank={bank} />;
};

/** The variant, keyed so a new variant or state starts from fresh data. */
const Host: React.FC<Props> = (props) => (
  <>
    <Variant key={`${props.variant}-${props.state}`} {...props} />
    <PrototypeSwitcher variants={PROTO_VARIANTS} states={PROTO_STATES} />
  </>
);

export default Host;
