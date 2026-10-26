import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Redirect, useHistory, useParams } from 'react-router-dom';
import { Box, ButtonBase, IconButton } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import PageTabs from '../../components/AddWords/PageTabs';
import PremadeWords, { PremadeWord } from '../../components/AddWords/PremadeWords';
import { BankLoading } from '../../components/AddWords/BankStates';
import Spinner from '../../components/UI/Spinner/Spinner';
import * as wordActions from '../../store/actions/index';
import * as wordService from '../../services/wordService';
import { loadCatalogue, loadPremadeEntries, PremadeList } from '../../services/premadeListService';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { RootState } from '../../types/store';
import { isCovered } from '../../utils/wordBank';
import { premadePath, routes } from '../../components/Navigation/navLinks';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
});

const mapDispatchToProps = {
  onAddPremadeList: wordActions.postAddPremadeList,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type Props = ConnectedProps<typeof connector>;

/** A premade list, its words, and how many of them the learner has. */
interface Shelf {
  list: PremadeList;
  words: PremadeWord[];
  held: number;
}

type Catalogue = Shelf[] | 'loading' | 'error';

type Filter = 'all' | 'new' | 'added';

/**
 * Every list of the catalogue with its words, and the words the learner has.
 * The catalogue shows how much of each list the learner has, so it loads them
 * all; the learner's words are one read.
 */
async function loadShelves(userId: string): Promise<Shelf[]> {
  const lists = await loadCatalogue();
  const entries = await Promise.all(lists.map((list) => loadPremadeEntries(list.id)));
  const held = new Map(
    (
      await wordService.getHeldWords(
        userId,
        entries.flat().map((entry) => entry.id),
      )
    ).map((word) => [word.id, word]),
  );
  return lists.map((list, i) => {
    const words = entries[i].map((entry): PremadeWord => {
      const word = held.get(entry.id);
      return { entry, state: !word ? 'new' : isCovered(word) ? 'covered' : 'added' };
    });
    return { list, words, held: words.filter((w) => w.state !== 'new').length };
  });
}

const buttonSx = {
  flex: 'none',
  height: 44,
  px: 2.5,
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 15,
  fontWeight: 600,
} as const;

// The same chip as the list chips (ListChips.tsx), so the two rows agree.
const chipSx = (on: boolean) => ({
  flex: 'none',
  height: 44,
  boxSizing: 'border-box',
  px: '14px',
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 14,
  fontWeight: on ? 600 : 400,
  color: on ? colors.primaryDark : colors.text,
  bgcolor: on ? colors.successSurface : colors.card,
  border: `1px solid ${on ? colors.primaryDark : colors.borderStrong}`,
});

const Progress: React.FC<{ part: number; height: number }> = ({ part, height }) => (
  <Box aria-hidden sx={{ height, borderRadius: 1, bgcolor: colors.blankDay, overflow: 'hidden' }}>
    <Box sx={{ width: `${part * 100}%`, height: '100%', bgcolor: colors.primaryDark }} />
  </Box>
);

/** The catalogue: one row for each premade list. */
const Catalogue: React.FC<{ shelves: Shelf[]; onOpen: (id: string) => void }> = ({
  shelves,
  onOpen,
}) => (
  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', textAlign: 'left' }}>
    {shelves.map(({ list, held }) => (
      <Box component="li" key={list.id} sx={{ borderBottom: `1px solid ${colors.divider}` }}>
        <ButtonBase
          onClick={() => onOpen(list.id)}
          sx={{
            width: '100%',
            minHeight: 64,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: 'flex-start',
            textAlign: 'left',
            fontFamily: fonts.body,
            color: colors.text,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontSize: 16, fontWeight: 600 }}>{list.name}</Box>
            <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
              {copy.premadeLists.size(list.size, held)}
            </Box>
            {held > 0 && (
              <Box sx={{ mt: 0.75 }}>
                <Progress part={held / list.size} height={3} />
              </Box>
            )}
          </Box>
          <Box component="span" aria-hidden sx={{ fontSize: 20, color: colors.textSecondary }}>
            ›
          </Box>
        </ButtonBase>
      </Box>
    ))}
  </Box>
);

/**
 * One premade list: the other lists as chips, the count of new words with Add,
 * and its words, filtered by whether the learner has them.
 */
const ListView: React.FC<{
  shelves: Shelf[];
  shelf: Shelf;
  charSet: 'simp' | 'trad';
  adding: boolean;
  onOpen: (id: string | undefined) => void;
  onAdd: (list: PremadeList) => void;
}> = ({ shelves, shelf, charSet, adding, onOpen, onAdd }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const { list, held } = shelf;
  const fresh = list.size - held;
  const words =
    filter === 'all'
      ? shelf.words
      : shelf.words.filter((w) => (filter === 'new') === (w.state === 'new'));
  const filters: [Filter, string][] = [
    ['all', copy.premadeLists.filterAll],
    ['new', copy.premadeLists.filterNew(fresh)],
    ['added', copy.premadeLists.filterAdded(held)],
  ];

  return (
    <Box sx={{ width: '100%', textAlign: 'left' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        {/* Back to the catalogue. It stays put while the chips scroll. */}
        <IconButton
          aria-label={copy.premadeLists.allLists}
          onClick={() => onOpen(undefined)}
          sx={{
            flex: 'none',
            width: 44,
            height: 44,
            ml: '-10px',
            borderRadius: 1,
            color: colors.text,
          }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box
          role="tablist"
          aria-label={copy.premadeLists.heading}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            mr: { xs: -2, sm: 0 },
            pr: { xs: 2, sm: 0 },
            pb: '6px',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {shelves.map(({ list: l }) => (
            <ButtonBase
              key={l.id}
              role="tab"
              aria-selected={l.id === list.id}
              // A list opened from far down the catalogue starts in view.
              ref={
                l.id === list.id
                  ? (el: HTMLElement | null) =>
                      el?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
                  : undefined
              }
              onClick={() => onOpen(l.id)}
              sx={chipSx(l.id === list.id)}
            >
              {l.name}
            </ButtonBase>
          ))}
        </Box>
      </Box>

      <Box sx={{ my: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {fresh.toLocaleString('en-GB')}
            </Box>
            <Box sx={{ mt: 0.5, fontSize: 16, color: colors.textSecondary }}>
              {copy.premadeLists.newWords(held)}
            </Box>
          </Box>
          <ButtonBase
            disabled={adding || fresh === 0}
            onClick={() => onAdd(list)}
            sx={{
              ...buttonSx,
              bgcolor: colors.primaryDark,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
              '&.Mui-disabled': { bgcolor: colors.divider, color: colors.textSecondary },
            }}
          >
            {adding ? copy.premadeLists.adding : copy.premadeLists.add}
          </ButtonBase>
        </Box>
        <Box sx={{ mt: 2 }}>
          <Progress part={held / list.size} height={6} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2.5, borderBottom: `1px solid ${colors.divider}` }}>
        {filters.map(([f, label]) => (
          <ButtonBase
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            sx={{
              height: 44,
              fontFamily: fonts.body,
              fontSize: 15,
              fontWeight: 600,
              color: filter === f ? colors.text : colors.textSecondary,
              borderBottom: `2px solid ${filter === f ? colors.primaryDark : 'transparent'}`,
              mb: '-1px',
            }}
          >
            {label}
          </ButtonBase>
        ))}
      </Box>
      <PremadeWords key={filter} words={words} charSet={charSet} />
    </Box>
  );
};

/**
 * The Premade lists tab of the Add words page: the catalogue, or one list of
 * it with Add. The words wait for the words the learner has: until then no one
 * knows which words to cover.
 */
const PremadeListPage: React.FC<Props> = ({ userId, authInitialized, onAddPremadeList }) => {
  const { listId } = useParams<{ listId?: string }>();
  const history = useHistory();
  const [charSet] = useState<'simp' | 'trad'>(
    () => (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad',
  );
  const [catalogue, setCatalogue] = useState<Catalogue>('loading');
  // Each attempt loads once; Retry starts the next.
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadShelves(userId).then(
      (loaded) => live && setCatalogue(loaded),
      () => live && setCatalogue('error'),
    );
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  const open = useCallback((id?: string) => history.push(premadePath(id)), [history]);

  const add = useCallback(
    async (list: PremadeList) => {
      setAdding(true);
      const added = await onAddPremadeList(list);
      setAdding(false);
      if (added) history.push(routes.add);
    },
    [onAddPremadeList, history],
  );

  if (!authInitialized) return <Spinner />;
  if (userId === null) return <Redirect to="/" />;

  const shelf =
    Array.isArray(catalogue) && listId ? catalogue.find((s) => s.list.id === listId) : undefined;
  if (Array.isArray(catalogue) && listId && !shelf) return <Redirect to={premadePath()} />;

  let body: React.ReactNode;
  if (catalogue === 'loading') {
    body = <BankLoading chips={!!listId} />;
  } else if (catalogue === 'error') {
    body = (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48 }}>
        <Box component="span" sx={{ flex: 1, fontSize: 15, color: colors.textSecondary }}>
          {copy.premadeLists.loadFailed}
        </Box>
        <ButtonBase
          onClick={() => {
            setCatalogue('loading');
            setAttempt((n) => n + 1);
          }}
          sx={{ ...buttonSx, border: `1px solid ${colors.borderStrong}`, color: colors.text }}
        >
          {copy.wordBank.retry}
        </ButtonBase>
      </Box>
    );
  } else if (shelf) {
    body = (
      <ListView
        key={shelf.list.id}
        shelves={catalogue}
        shelf={shelf}
        charSet={charSet}
        adding={adding}
        onOpen={open}
        onAdd={add}
      />
    );
  } else {
    body = <Catalogue shelves={catalogue} onOpen={open} />;
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
        textAlign: 'left',
      }}
    >
      <PageTabs tab="premade" onTab={(t) => (t === 'mine' ? history.push(routes.add) : open())} />
      {body}
    </Box>
  );
};

export default connector(PremadeListPage);
