import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Redirect, useHistory } from 'react-router-dom';
import {
  Box,
  ButtonBase,
  IconButton,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';

import SearchField from '../../components/AddWords/SearchField';
import ListChips, { Chip } from '../../components/AddWords/ListChips';
import WordRow from '../../components/AddWords/WordRow';
import SearchResults, { EntryState, SearchStatus } from '../../components/AddWords/SearchResults';
import { DeleteListDialog, ListNameDialog } from '../../components/AddWords/ListDialogs';
import { BankEmpty, BankLoadError, BankLoading } from '../../components/AddWords/BankStates';
import { Overline } from '../../components/Test/Study/parts';
import Spinner from '../../components/UI/Spinner/Spinner';
import * as wordActions from '../../store/actions/index';
import * as wordService from '../../services/wordService';
import { reportError } from '../../services/errorReporting';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import { findInBank, isCovered, matchesBank } from '../../utils/wordBank';
import {
  customWordMeaningSchema,
  customWordTextSchema,
  searchInputSchema,
} from '../../validation/schemas';

const ALL_LISTS = '__all__';
const DEFAULT_LIST = 'default';

// The pause after typing before the dictionary is asked. Enter asks at once.
const SEARCH_DELAY_MS = 400;

// The dictionary function looks up characters only, so a query with no Han
// character filters the bank and does not ask it.
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  error: state.addWords.error,
  loading: state.addWords.loading,
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
  listStats: state.addWords.listStats,
});

const mapDispatchToProps = {
  onPostWord: wordActions.postWord,
  onPostCustomWord: wordActions.postCustomWord,
  onDeleteWord: wordActions.deleteWord,
  onInitWords: wordActions.initWords,
  onPostMeaningUpdate: wordActions.postUpdateMeaning,
  onMoveWord: wordActions.postMoveWord,
  onSwitchList: wordActions.switchActiveList,
  onCreateList: wordActions.postCreateWordList,
  onRenameList: wordActions.postRenameWordList,
  onDeleteList: wordActions.postDeleteWordList,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector>;

/**
 * The word bank. One search field filters the bank and asks the dictionary;
 * its results take the place of the word list. The lists are chips under the
 * field, and a word row opens in place.
 */
const AddWords: React.FC<Props> = ({
  words,
  error,
  loading,
  userId,
  authInitialized,
  lists,
  activeListId,
  listStats,
  onPostWord,
  onPostCustomWord,
  onDeleteWord,
  onInitWords,
  onPostMeaningUpdate,
  onMoveWord,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
}) => {
  const history = useHistory();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });
  const [charSet] = useState<'simp' | 'trad'>(
    () => (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad',
  );

  const [query, setQueryText] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<Word[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  // The kind of dialog stays set while it closes, so its title and fields do
  // not change during the exit transition.
  const [dialogKind, setDialogKind] = useState<'new' | 'rename' | 'delete'>('new');
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = useCallback((kind: 'new' | 'rename' | 'delete') => {
    setDialogKind(kind);
    setDialogOpen(true);
  }, []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // Each search takes a number, so an answer that comes back after a newer
  // search started is dropped.
  const searchSeq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (userId !== null) onInitWords();
  }, [onInitWords, userId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const runSearch = useCallback(
    async (text: string) => {
      clearTimeout(timer.current);
      const seq = ++searchSeq.current;
      const parsed = searchInputSchema.safeParse(text);
      if (!parsed.success || !HAN.test(parsed.data)) {
        setStatus('idle');
        setResults([]);
        return;
      }
      setStatus('searching');
      try {
        const found = await wordService.searchWord(parsed.data, charSet);
        if (seq !== searchSeq.current) return;
        setResults(found);
        setStatus('done');
      } catch (err) {
        if (seq !== searchSeq.current) return;
        console.error('Failed to search for word:', err);
        reportError(err, { feature: 'add-words-search' });
        setStatus('error');
      }
    },
    [charSet],
  );

  const setQuery = useCallback(
    (text: string) => {
      setQueryText(text);
      clearTimeout(timer.current);
      if (HAN.test(text)) {
        setStatus('searching');
        timer.current = setTimeout(() => runSearch(text), SEARCH_DELAY_MS);
      } else {
        searchSeq.current++;
        setStatus('idle');
        setResults([]);
      }
    },
    [runSearch],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(timer.current);
    searchSeq.current++;
    setQueryText('');
    setStatus('idle');
    setResults([]);
    document.getElementById('addInput')?.focus();
  }, []);

  const trySuggestion = useCallback(
    (text: string) => {
      setQueryText(text);
      runSearch(text);
    },
    [runSearch],
  );

  const addOwnWord = useCallback(
    (meaning: string) => {
      const text = customWordTextSchema.safeParse(query);
      const parsedMeaning = customWordMeaningSchema.safeParse(meaning);
      if (!text.success || !parsedMeaning.success) return;
      onPostCustomWord({ text: text.data, meaning: parsedMeaning.data, charSet });
      clearSearch();
    },
    [query, charSet, onPostCustomWord, clearSearch],
  );

  const toggle = useCallback((id: number) => setOpenId((open) => (open === id ? null : id)), []);

  const moveWord = useCallback(
    (id: number, listId: string, label: string) => {
      onMoveWord(id, listId, label);
      setOpenId(null);
    },
    [onMoveWord],
  );

  const removeWord = useCallback(
    (id: number) => {
      onDeleteWord(id);
      setOpenId(null);
    },
    [onDeleteWord],
  );

  const totalWords = useMemo(
    () => Object.values(listStats).reduce((sum, s) => sum + (s?.total ?? 0), 0),
    [listStats],
  );
  const totalDue = useMemo(
    () => Object.values(listStats).reduce((sum, s) => sum + (s?.due ?? 0), 0),
    [listStats],
  );

  const chips: Chip[] = useMemo(() => {
    // The active list counts its loaded words, which are fresher than the
    // stats after an add or a remove.
    const count = (id: string) =>
      id === activeListId && !loading ? words.length : (listStats[id]?.total ?? 0);
    const own = lists.map((l) => ({ id: l.id, name: l.name, count: count(l.id) }));
    if (lists.length < 2) return own;
    const all = activeListId === ALL_LISTS && !loading ? words.length : totalWords;
    return [{ id: ALL_LISTS, name: copy.wordBank.allLists, count: all }, ...own];
  }, [lists, listStats, activeListId, words.length, loading, totalWords]);

  // Wait for auth to initialize before redirecting.
  if (!authInitialized) return <Spinner />;
  if (userId === null) return <Redirect to="/" />;

  const searching = query.trim().length > 0;
  const bankMatches = searching ? words.filter((w) => matchesBank(w, query)) : [];
  const activeList = lists.find((l) => l.id === activeListId);
  const listName = activeListId === ALL_LISTS ? copy.wordBank.allLists : (activeList?.name ?? '');
  const canEditList = activeListId !== ALL_LISTS && activeListId !== DEFAULT_LIST && !!activeList;
  const due = activeListId === ALL_LISTS ? totalDue : (listStats[activeListId]?.due ?? 0);
  // The first load has no stats yet, so the chips are grey blocks too.
  const firstLoad = loading && Object.keys(listStats).length === 0;

  const row = (w: Word) => (
    <WordRow
      key={w.id}
      word={w}
      charSet={charSet}
      lists={lists}
      open={openId === w.id}
      onToggle={() => toggle(w.id)}
      onMeaningChange={onPostMeaningUpdate}
      onMove={moveWord}
      onRemove={removeWord}
    />
  );

  let body: React.ReactNode;
  if (searching) {
    body = (
      <Box sx={{ mt: 0.5 }}>
        <SearchResults
          query={query.trim()}
          status={status}
          results={results}
          charSet={charSet}
          stateOf={(entry): EntryState => {
            const held = findInBank(entry, words);
            return !held ? 'new' : isCovered(held) ? 'covered' : 'added';
          }}
          onAdd={onPostWord}
          onAddOwn={addOwnWord}
          onRetry={() => runSearch(query)}
        />
        {status === 'idle' && bankMatches.length === 0 && (
          <Box component="p" sx={{ my: 1, fontSize: 15, color: colors.textSecondary }}>
            {copy.wordBank.noMatch}
          </Box>
        )}
        {bankMatches.length > 0 && (
          <>
            <Overline component="h2" sx={{ m: 0, mt: status === 'idle' ? 0 : 3, mb: 0.5 }}>
              {copy.wordBank.inBank}
            </Overline>
            {bankMatches.map(row)}
          </>
        )}
      </Box>
    );
  } else if (loading) {
    body = <BankLoading chips={firstLoad} />;
  } else if (error) {
    body = <BankLoadError onRetry={onInitWords} />;
  } else if (words.length === 0) {
    body = (
      <BankEmpty
        title={totalWords === 0 ? copy.wordBank.noWords : copy.wordBank.emptyList}
        onTry={trySuggestion}
      />
    );
  } else {
    body = (
      <Box>
        <Box sx={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Overline component="h1" sx={{ flex: 1, m: 0, fontWeight: 400 }}>
            {copy.wordBank.heading(listName, words.length)}
          </Overline>
          {desktop && (
            <ButtonBase
              onClick={() => history.push('/test-words')}
              sx={{
                height: 44,
                px: 2.5,
                borderRadius: 1,
                bgcolor: colors.primaryDark,
                color: colors.white,
                fontFamily: fonts.body,
                fontSize: 15,
                fontWeight: 600,
                '&:hover': { bgcolor: colors.primaryDarkHover },
              }}
            >
              {due > 0 ? copy.wordBank.studyDue(due) : copy.wordBank.study}
            </ButtonBase>
          )}
          {canEditList && (
            <IconButton
              aria-label={copy.wordBank.listActions}
              aria-haspopup="menu"
              aria-expanded={!!menuAnchor}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{
                width: 44,
                height: 44,
                mr: '-10px',
                borderRadius: 1,
                color: colors.text,
                bgcolor: menuAnchor ? colors.skeleton : 'transparent',
              }}
            >
              <MoreHorizRoundedIcon />
            </IconButton>
          )}
        </Box>
        {words.map(row)}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 720,
        mx: 'auto',
        pb: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      <SearchField
        query={query}
        busy={status === 'searching'}
        onChange={setQuery}
        onSubmit={() => runSearch(query)}
        onClear={clearSearch}
      />
      {!searching && !firstLoad && (
        <ListChips
          chips={chips}
          activeId={activeListId}
          onSwitch={(id) => {
            setOpenId(null);
            onSwitchList(id);
          }}
          onNew={() => openDialog('new')}
        />
      )}
      {body}

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 180, borderRadius: 1 } } }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            openDialog('rename');
          }}
          sx={{ height: 44, fontFamily: fonts.body, fontSize: 15 }}
        >
          {copy.wordBank.rename}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            openDialog('delete');
          }}
          sx={{ height: 44, fontFamily: fonts.body, fontSize: 15, color: colors.primaryLight }}
        >
          {copy.wordBank.delete}
        </MenuItem>
      </Menu>
      <ListNameDialog
        open={dialogOpen && dialogKind !== 'delete'}
        title={
          dialogKind === 'rename' ? copy.wordBank.renameTitle(listName) : copy.wordBank.newList
        }
        initial={dialogKind === 'rename' ? listName : ''}
        action={dialogKind === 'rename' ? copy.wordBank.save : copy.wordBank.create}
        onClose={() => closeDialog()}
        onSave={(name) => {
          if (dialogKind === 'rename') onRenameList(activeListId, name);
          else onCreateList(name);
          closeDialog();
        }}
      />
      <DeleteListDialog
        open={dialogOpen && dialogKind === 'delete'}
        name={listName}
        words={words.length}
        onClose={() => closeDialog()}
        onDelete={() => {
          onDeleteList(activeListId);
          closeDialog();
        }}
      />
    </Box>
  );
};

export default connector(AddWords);
