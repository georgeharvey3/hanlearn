import React, { useState } from 'react';
import { Box, ButtonBase, InputBase } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { Overline, hanziSx } from '../Test/Study/parts';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { Word } from '../../types/models';
import { Block } from './BankStates';

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

/**
 * An entry the bank does not hold, one it holds, or one it holds and covers.
 * A covered entry shows no pinyin or meaning, as its bank row does.
 */
export type EntryState = 'new' | 'added' | 'covered';

const buttonSx = {
  flex: 'none',
  height: 44,
  px: '14px',
  gap: 0.5,
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 15,
  fontWeight: 600,
} as const;

const primarySx = {
  ...buttonSx,
  bgcolor: colors.primaryDark,
  color: colors.white,
  '&:hover': { bgcolor: colors.primaryDarkHover },
  '&.Mui-disabled': { bgcolor: colors.divider, color: colors.textSecondary },
} as const;

/** One dictionary entry, with its Add button. A clash is several of these. */
const ResultRow: React.FC<{
  entry: Word;
  charSet: 'simp' | 'trad';
  state: EntryState;
  onAdd: (entry: Word) => void;
}> = ({ entry, charSet, state, onAdd }) => (
  <Box
    sx={{
      minHeight: 72,
      boxSizing: 'border-box',
      py: 1.5,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      borderBottom: `1px solid ${colors.divider}`,
    }}
  >
    <Box lang="zh" sx={hanziSx(32, { minWidth: 56 })}>
      {entry[charSet]}
    </Box>
    {state === 'covered' ? (
      <Box aria-hidden sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Block width={72} height={12} />
        <Block width={140} height={10} />
      </Box>
    ) : (
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
          {entry.pinyin}
        </Box>
        <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{entry.meaning}</Box>
      </Box>
    )}
    {state !== 'new' ? (
      <Box
        sx={{
          ...buttonSx,
          px: 0.5,
          display: 'flex',
          alignItems: 'center',
          color: colors.primaryDark,
        }}
      >
        <CheckRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
        {copy.wordBank.added}
      </Box>
    ) : (
      <ButtonBase
        onClick={() => onAdd(entry)}
        aria-label={copy.wordBank.addEntry(entry[charSet], entry.pinyin)}
        sx={primarySx}
      >
        <AddRoundedIcon aria-hidden sx={{ fontSize: 16 }} />
        {copy.wordBank.add}
      </ButtonBase>
    )}
  </Box>
);

/** No dictionary entry: the learner gives a meaning and adds the word anyway. */
const OwnWordForm: React.FC<{ query: string; onAdd: (meaning: string) => void }> = ({
  query,
  onAdd,
}) => {
  const [meaning, setMeaning] = useState('');
  const ready = meaning.trim().length > 0;
  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        if (ready) onAdd(meaning.trim());
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box component="p" sx={{ my: 1, fontSize: 15 }}>
        {copy.wordBank.noEntry}
        <span lang="zh">{query}</span>
      </Box>
      <Overline component="label" htmlFor="own-word-meaning">
        {copy.wordBank.addOwn}
      </Overline>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <InputBase
          id="own-word-meaning"
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder={copy.wordBank.meaning}
          inputProps={{ maxLength: 500 }}
          sx={{
            flex: 1,
            minWidth: 0,
            height: 48,
            boxSizing: 'border-box',
            px: '14px',
            borderRadius: 1,
            border: `1px solid ${colors.borderStrong}`,
            bgcolor: colors.card,
            fontFamily: fonts.body,
            fontSize: 16,
            '&.Mui-focused': { borderColor: colors.primaryDark },
          }}
        />
        <ButtonBase type="submit" disabled={!ready} sx={{ ...primarySx, height: 48, px: 2.5 }}>
          {copy.wordBank.add}
        </ButtonBase>
      </Box>
    </Box>
  );
};

interface Props {
  query: string;
  status: SearchStatus;
  results: Word[];
  charSet: 'simp' | 'trad';
  stateOf: (entry: Word) => EntryState;
  onAdd: (entry: Word) => void;
  onAddOwn: (meaning: string) => void;
  onRetry: () => void;
}

/** What the dictionary gave for the search: the entries, the own-word form, or an error. */
const SearchResults: React.FC<Props> = ({
  query,
  status,
  results,
  charSet,
  stateOf,
  onAdd,
  onAddOwn,
  onRetry,
}) => {
  if (status === 'searching') {
    return (
      <Box component="p" role="status" sx={{ my: 1, fontSize: 15, color: colors.textSecondary }}>
        {copy.wordBank.searching}
      </Box>
    );
  }
  if (status === 'error') {
    return (
      <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <Box component="p" sx={{ flex: 1, m: 0, fontSize: 15, color: colors.primaryLight }}>
          {copy.wordBank.searchFailed}
        </Box>
        <ButtonBase
          onClick={onRetry}
          sx={{
            ...buttonSx,
            px: 2.5,
            border: `1px solid ${colors.borderStrong}`,
            color: colors.text,
          }}
        >
          {copy.wordBank.retry}
        </ButtonBase>
      </Box>
    );
  }
  if (status !== 'done') return null;
  if (results.length === 0) return <OwnWordForm key={query} query={query} onAdd={onAddOwn} />;
  return (
    <Box>
      <Overline component="h2" sx={{ m: 0, mb: 0.5, fontWeight: 400 }}>
        {copy.wordBank.results(results.length)}
      </Overline>
      {results.map((entry) => (
        <ResultRow
          key={`${entry.id}-${entry.pinyin}`}
          entry={entry}
          charSet={charSet}
          state={stateOf(entry)}
          onAdd={onAdd}
        />
      ))}
    </Box>
  );
};

export default SearchResults;
