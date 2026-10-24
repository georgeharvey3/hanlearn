import React, { useEffect } from 'react';
import { Box, CircularProgress, IconButton, InputBase } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';

interface Props {
  query: string;
  busy: boolean;
  onChange: (query: string) => void;
  /** Enter: search now, without the pause after typing. */
  onSubmit: () => void;
  onClear: () => void;
}

/**
 * The one field of the word bank. It filters the bank and asks the dictionary.
 * Ctrl+B focuses it from anywhere on the page.
 */
const SearchField: React.FC<Props> = ({ query, busy, onChange, onSubmit, onClear }) => {
  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') document.getElementById('addInput')?.focus();
    };
    document.addEventListener('keyup', onKeyUp);
    return () => document.removeEventListener('keyup', onKeyUp);
  }, []);

  return (
    <Box
      component="form"
      role="search"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        height: 52,
        boxSizing: 'border-box',
        pl: '14px',
        pr: 0.5,
        bgcolor: colors.card,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: 1,
        fontFamily: fonts.body,
        '&:focus-within': {
          borderColor: colors.primaryDark,
          boxShadow: `inset 0 0 0 1px ${colors.primaryDark}`,
        },
      }}
    >
      {busy ? (
        <CircularProgress
          size={20}
          thickness={5}
          aria-label={copy.wordBank.searching}
          sx={{ color: colors.primaryDark, flex: 'none' }}
        />
      ) : (
        <SearchRoundedIcon aria-hidden sx={{ color: colors.textSecondary, flex: 'none' }} />
      )}
      <InputBase
        id="addInput"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy.wordBank.search}
        inputProps={{ 'aria-label': copy.wordBank.search, maxLength: 100, lang: 'zh' }}
        sx={{ flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: 17, color: colors.text }}
      />
      {query && (
        <IconButton
          onClick={onClear}
          aria-label={copy.wordBank.clear}
          sx={{ width: 44, height: 44, color: colors.textSecondary, borderRadius: 1 }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
};

export default SearchField;
