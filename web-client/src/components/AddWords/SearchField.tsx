import React, { useEffect } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  InputBase,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DrawRoundedIcon from '@mui/icons-material/DrawRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { SearchMode } from '../../utils/searchMode';

interface Props {
  query: string;
  busy: boolean;
  mode: SearchMode;
  onMode: (mode: SearchMode) => void;
  onChange: (query: string) => void;
  /** Enter: search now, without the pause after typing. */
  onSubmit: () => void;
  onClear: () => void;
  /** Whether the handwriting pad is open (#476). */
  padOpen: boolean;
  /** The pen button: open or close the pad. */
  onPen: () => void;
  /**
   * True while the pad takes the place of the system keyboard, on a phone.
   * The field keeps its focus and caret, and asks for no keyboard.
   */
  noKeyboard: boolean;
}

/**
 * The one field of the word bank. It filters the bank and asks the dictionary.
 * Ctrl+B focuses it from anywhere on the page. The toggle at its end sets the
 * search mode, as in Pleco (#577). The pen button before it opens the
 * handwriting pad (#476).
 */
const SearchField: React.FC<Props> = ({
  query,
  busy,
  mode,
  onMode,
  onChange,
  onSubmit,
  onClear,
  padOpen,
  onPen,
  noKeyboard,
}) => {
  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'b') document.getElementById('addInput')?.focus();
    };
    document.addEventListener('keyup', onKeyUp);
    return () => document.removeEventListener('keyup', onKeyUp);
  }, []);

  const label = mode === 'chinese' ? copy.wordBank.search : copy.wordBank.searchEnglish;

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
        placeholder={label}
        inputProps={{
          'aria-label': label,
          maxLength: 100,
          lang: mode === 'chinese' ? 'zh' : 'en',
          inputMode: noKeyboard ? 'none' : undefined,
        }}
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
      <IconButton
        onClick={onPen}
        // A tap keeps the focus in the field, so its caret stays.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={copy.wordBank.draw}
        aria-pressed={padOpen}
        sx={{
          width: 44,
          height: 44,
          flex: 'none',
          borderRadius: 1,
          color: padOpen ? colors.white : colors.textSecondary,
          bgcolor: padOpen ? colors.primaryDark : 'transparent',
          '&:hover': { bgcolor: padOpen ? colors.primaryDarkHover : undefined },
        }}
      >
        <DrawRoundedIcon fontSize="small" />
      </IconButton>
      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(_, next: SearchMode | null) => next && onMode(next)}
        aria-label={copy.wordBank.searchMode}
        sx={{ flex: 'none', height: 36, mr: 0.5 }}
      >
        {(['chinese', 'english'] as const).map((m) => (
          <ToggleButton
            key={m}
            value={m}
            aria-label={copy.wordBank.modes[m].name}
            sx={{
              minWidth: 40,
              px: 1,
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              textTransform: 'none',
              color: colors.textSecondary,
              borderColor: colors.borderStrong,
              '&.Mui-selected, &.Mui-selected:hover': {
                bgcolor: colors.primaryDark,
                color: colors.white,
              },
            }}
          >
            {copy.wordBank.modes[m].short}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default SearchField;
