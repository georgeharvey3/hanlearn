import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { Box, ButtonBase } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import * as wordActions from '../../store/actions/index';
import * as wordService from '../../services/wordService';
import { getEntry, searchWord } from '../../services/dictionaryService';
import { reportError } from '../../services/errorReporting';
import { isCovered } from '../../utils/wordBank';
import { hanziOf, isCustomWord } from '../../utils/wordPage';
import { routes, wordPath } from '../../components/Navigation/navLinks';
import { useStickyTop } from '../../components/Layout/stickyTop';
import { PageError, PageLoading } from '../../components/UI/PageState/PageState';
import { Block } from '../../components/AddWords/BankStates';
import WordHeader from '../../components/WordPage/WordHeader';
import MeaningTab from '../../components/WordPage/MeaningTab';
import CharactersTab from '../../components/WordPage/CharactersTab';
import ProgressTab from '../../components/WordPage/ProgressTab';
import { useCharacterReadings } from '../../components/WordPage/useCharacterReadings';

/**
 * What a link to the word page passes in the router state. A search result
 * passes its entry, so the page needs no dictionary call. The word row passes
 * `shown` when the learner already lifted its cover.
 */
export interface WordPageLocationState {
  entry?: Word;
  shown?: boolean;
}

type CharSet = 'simp' | 'trad';
type Tab = 'meaning' | 'characters' | 'progress';

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  lists: state.addWords.lists,
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
  voice: state.settings.voice,
  lang: state.settings.lang,
});

const mapDispatchToProps = {
  onPostWord: wordActions.postWord,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector> & { wordId: number };

type Load = 'loading' | 'error' | 'missing' | 'done';

const EMPTY_WORD: Word = { id: 0, simp: '', trad: '', pinyin: '', meaning: '' };

const readCharSet = (): CharSet => (localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad');

/** The cover of a word due soon: grey blocks in place of the page, and one control. */
const WordCover: React.FC<{ onShow: () => void }> = ({ onShow }) => (
  <ButtonBase
    onClick={onShow}
    sx={{
      width: '100%',
      py: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      fontFamily: fonts.body,
    }}
  >
    <Block width={140} height={56} />
    <Block width={96} height={14} />
    <Block width={200} height={12} />
    <Box component="span" sx={{ fontSize: 13, color: colors.textSecondary }}>
      {copy.wordBank.dueSoon}
    </Box>
    <Box
      component="span"
      sx={{
        height: 44,
        px: 2.5,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1,
        border: `1px solid ${colors.borderStrong}`,
        fontSize: 15,
        fontWeight: 600,
        color: colors.text,
      }}
    >
      {copy.wordBank.showWord}
    </Box>
  </ButtonBase>
);

/**
 * The page of one dictionary entry, or of a custom word (#562). It shows the
 * word, its senses, its characters, one example sentence and, for the
 * learner's word, the progress. The page manages nothing: the word row does.
 * The one action is Add, for an entry that the learner does not have.
 *
 * It obeys the no-leak rule: a word due soon stays covered until the learner
 * asks to see it.
 */
const WordPageBody: React.FC<Props> = ({
  wordId,
  words,
  lists,
  userId,
  authInitialized,
  voice,
  lang,
  onPostWord,
}) => {
  const history = useHistory();
  const location = useLocation<WordPageLocationState | undefined>();
  const stickyTop = useStickyTop();
  const passed = location.state?.entry?.id === wordId ? location.state.entry : undefined;

  // The learner's word: the active list in the store first, then the document.
  const storeWord = words.find((w) => w.id === wordId) ?? null;
  const [readOwned, setReadOwned] = useState<Word | null>(null);
  const [entry, setEntry] = useState<Word | null>(passed ?? null);
  const [load, setLoad] = useState<Load>(storeWord ? 'done' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState(Boolean(location.state?.shown));
  const [charSet, setCharSet] = useState<CharSet>(readCharSet);
  const [tab, setTab] = useState<Tab>('meaning');
  const [charIndex, setCharIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [otherReadings, setOtherReadings] = useState<Word[]>([]);

  const owned = storeWord ?? readOwned;
  const word = owned ?? entry;

  useEffect(() => {
    if (storeWord || !authInitialized) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const held = userId ? await wordService.getUserWord(userId, wordId) : null;
        if (cancelled) return;
        if (held) {
          setReadOwned(held);
          setLoad('done');
          return;
        }
        if (passed) {
          setLoad('done');
          return;
        }
        // A custom word has a negative id, and no entry.
        const found = Number.isInteger(wordId) && wordId >= 0 ? await getEntry(wordId) : null;
        if (cancelled) return;
        setEntry(found);
        setLoad(found ? 'done' : 'missing');
      } catch (error) {
        reportError(error, { feature: 'word-page', context: { wordId } });
        if (!cancelled) setLoad('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // The store word ends the load; a later change to it needs no new read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId, userId, authInitialized, attempt]);

  // The other entries with the same characters: 行 háng beside 行 xíng.
  const text = word ? word[charSet] : '';
  const custom = word ? isCustomWord(word) : false;
  useEffect(() => {
    if (!text || custom) return undefined;
    let cancelled = false;
    searchWord(text, charSet)
      .then((found) => {
        if (!cancelled) setOtherReadings(found.filter((other) => other.id !== wordId));
      })
      .catch((error) => reportError(error, { feature: 'word-page-readings' }));
    return () => {
      cancelled = true;
    };
  }, [text, charSet, custom, wordId]);

  const chars = hanziOf(text);
  const readingsAt = useCharacterReadings(word ?? EMPTY_WORD, chars, charSet);

  const add = useCallback(async () => {
    if (!entry) return;
    setAdding(true);
    await onPostWord(entry);
    setAdding(false);
  }, [entry, onPostWord]);

  const back = () => (history.length > 1 ? history.goBack() : history.push(routes.add));

  if (load === 'loading' && !word) return <PageLoading />;
  if (load === 'error') {
    const retry = () => {
      setLoad('loading');
      setAttempt((n) => n + 1);
    };
    return <PageError onRetry={retry} />;
  }
  if (!word) {
    return (
      <Box component="p" role="alert" sx={{ mt: 6, fontSize: 17, fontWeight: 600 }}>
        {copy.wordPage.notFound}
      </Box>
    );
  }

  const covered = owned !== null && isCovered(owned) && !shown;
  const tabs: [Tab, string][] = [
    ['meaning', copy.wordPage.meaningTab],
    ...(chars.length > 0 ? [['characters', copy.wordPage.charactersTab] as [Tab, string]] : []),
    ...(owned ? [['progress', copy.wordPage.progressTab] as [Tab, string]] : []),
  ];
  const activeTab = tabs.some(([key]) => key === tab) ? tab : 'meaning';
  const index = Math.min(charIndex, Math.max(chars.length - 1, 0));

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, pb: 4, textAlign: 'left' }}>
      <ButtonBase
        onClick={back}
        sx={{ height: 44, gap: 0.5, fontFamily: fonts.body, fontSize: 14, color: colors.text }}
      >
        <ArrowBackRoundedIcon aria-hidden sx={{ fontSize: 18 }} />
        {copy.wordPage.back}
      </ButtonBase>
      {covered ? (
        <WordCover onShow={() => setShown(true)} />
      ) : (
        <>
          <Box
            sx={{
              position: 'sticky',
              top: stickyTop,
              zIndex: 2,
              pt: 1,
              bgcolor: colors.paper,
              borderBottom: `1px solid ${colors.divider}`,
            }}
          >
            <WordHeader
              word={word}
              owned={owned}
              charSet={charSet}
              onCharSet={setCharSet}
              onAdd={add}
              adding={adding || !userId}
              voice={voice}
              lang={lang}
            />
            <Box role="tablist" sx={{ display: 'flex', mt: 1.5 }}>
              {tabs.map(([key, label]) => (
                <ButtonBase
                  key={key}
                  role="tab"
                  aria-selected={activeTab === key}
                  onClick={() => setTab(key)}
                  sx={{
                    flex: 1,
                    height: 44,
                    fontFamily: fonts.body,
                    fontSize: 14,
                    fontWeight: 600,
                    color: activeTab === key ? colors.text : colors.textSecondary,
                    borderBottom: `2px solid ${activeTab === key ? colors.primaryDark : 'transparent'}`,
                  }}
                >
                  {label}
                </ButtonBase>
              ))}
            </Box>
          </Box>
          <Box role="tabpanel">
            {activeTab === 'meaning' && (
              <MeaningTab
                word={word}
                owned={owned}
                charSet={charSet}
                chars={chars}
                readingsAt={readingsAt}
                otherReadings={otherReadings}
                onOpenCharacter={(i) => {
                  setCharIndex(i);
                  setTab('characters');
                }}
                onOpenReading={(other) =>
                  history.push(wordPath(other.id), { entry: other } as WordPageLocationState)
                }
                voice={voice}
                lang={lang}
              />
            )}
            {activeTab === 'characters' && chars.length > 0 && (
              <CharactersTab
                chars={chars}
                index={index}
                onSelect={setCharIndex}
                readingsAt={readingsAt}
              />
            )}
            {activeTab === 'progress' && owned && <ProgressTab word={owned} lists={lists} />}
          </Box>
        </>
      )}
    </Box>
  );
};

const ConnectedBody = connector(WordPageBody);

/** The route `/word/:id`. A new id starts a new page, with no state of the last one. */
const WordPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const wordId = Number(id);
  return <ConnectedBody key={id} wordId={wordId} />;
};

export default WordPage;
