// PROTOTYPE (#405): small pieces the word bank variants share: the search
// field, a dictionary result, the custom word form, the word detail, the list
// name dialog and the toast. The layouts stay in each variant. Throwaway.
import React, { useEffect, useState } from 'react';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Dialog,
  IconButton,
  InputBase,
  Snackbar,
  SxProps,
  Theme,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import MeaningEditor from '../../UI/MeaningEditor/MeaningEditor';
import { Overline, StudyButton, hanziSx } from '../../Test/Study/parts';
import { colors, fonts, shadows } from '../../../theme';
import { Word } from '../../../types/models';
import { DIRECTION_LABELS, leechDirections } from '../../../utils/directions';
import { BankProps, dueText, levelColor, levelName, levelOf, meaningOf, protoCopy } from './shared';

const font = { fontFamily: fonts.body, textAlign: 'left' } as const;

// ---------------------------------------------------------------- search

export const SearchField: React.FC<{
  bank: BankProps;
  autoFocus?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
  onFocus?: () => void;
}> = ({ bank, autoFocus, placeholder, sx, onFocus }) => (
  <Box
    component="form"
    role="search"
    onSubmit={(e: React.FormEvent) => {
      e.preventDefault();
      bank.submit();
    }}
    sx={[
      {
        ...font,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        height: 52,
        px: 1.5,
        bgcolor: colors.card,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: 1,
        '&:focus-within': { borderColor: colors.primaryDark },
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {bank.status === 'searching' ? (
      <CircularProgress size={20} sx={{ color: colors.textSecondary, mx: '2px' }} />
    ) : (
      <SearchRoundedIcon sx={{ color: colors.textSecondary }} />
    )}
    <InputBase
      id="addInput"
      autoFocus={autoFocus}
      value={bank.query}
      onChange={(e) => bank.setQuery(e.target.value)}
      onFocus={onFocus}
      placeholder={placeholder ?? protoCopy.searchPlaceholder}
      inputProps={{ 'aria-label': protoCopy.search, maxLength: 100, lang: 'zh' }}
      sx={{ flex: 1, fontSize: 17, ...font }}
    />
    {bank.query && (
      <IconButton size="small" onClick={bank.clearSearch} aria-label={protoCopy.clear}>
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    )}
  </Box>
);

/** One dictionary entry, with its Add button. A clash is just several rows. */
export const ResultRow: React.FC<{ word: Word; bank: BankProps; dense?: boolean }> = ({
  word,
  bank,
  dense,
}) => {
  const added = bank.isInBank(word);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: dense ? 1 : 1.5,
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      <Box lang="zh" sx={hanziSx(dense ? 26 : 32, { minWidth: 56 })}>
        {word[bank.charSet]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
          {word.pinyin}
        </Box>
        <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{word.meaning}</Box>
      </Box>
      <ButtonBase
        disabled={added}
        onClick={() => bank.addWord(word)}
        aria-label={added ? protoCopy.inBank : `${protoCopy.add} ${word[bank.charSet]}`}
        sx={{
          ...font,
          flex: 'none',
          height: 36,
          px: 1.5,
          gap: 0.5,
          borderRadius: 1,
          fontSize: 14,
          fontWeight: 600,
          color: added ? colors.textSecondary : colors.white,
          bgcolor: added ? 'transparent' : colors.primaryDark,
        }}
      >
        {added ? <CheckRoundedIcon fontSize="small" /> : <AddRoundedIcon fontSize="small" />}
        {added ? protoCopy.added : protoCopy.add}
      </ButtonBase>
    </Box>
  );
};

/** No dictionary entry: the learner gives the meaning and adds it anyway. */
export const CustomWordForm: React.FC<{ bank: BankProps }> = ({ bank }) => {
  const [meaning, setMeaning] = useState('');
  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ fontSize: 15, mb: 1.5 }}>{protoCopy.noResult(bank.query)}</Box>
      <Overline sx={{ mb: 0.5 }}>{protoCopy.addCustom}</Overline>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <InputBase
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          placeholder={protoCopy.meaningLabel}
          inputProps={{ 'aria-label': protoCopy.meaningLabel, maxLength: 500 }}
          sx={{
            ...font,
            flex: 1,
            height: 44,
            px: 1.5,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 1,
            bgcolor: colors.card,
          }}
        />
        <StudyButton
          variant="primary"
          disabled={!meaning.trim()}
          onClick={() => {
            bank.addCustom(bank.query, meaning);
            bank.clearSearch();
          }}
          sx={{ width: 'auto', px: 2.5, height: 44 }}
        >
          {protoCopy.add}
        </StudyButton>
      </Box>
    </Box>
  );
};

/** What the search shows: results, the custom form, or an error. */
export const SearchResults: React.FC<{ bank: BankProps; dense?: boolean }> = ({ bank, dense }) => {
  if (bank.status === 'error')
    return <Box sx={{ py: 2, color: colors.primaryLight }}>{protoCopy.searchFailed}</Box>;
  if (bank.status === 'searching' && bank.results.length === 0)
    return <Box sx={{ py: 2, color: colors.textSecondary }}>{protoCopy.searching}</Box>;
  if (bank.status === 'done' && bank.results.length === 0) return <CustomWordForm bank={bank} />;
  return (
    <Box>
      {bank.results.map((w) => (
        <ResultRow key={w.id} word={w} bank={bank} dense={dense} />
      ))}
    </Box>
  );
};

// ---------------------------------------------------------------- word

export const LevelPip: React.FC<{ word: Word; withLabel?: boolean }> = ({ word, withLabel }) => {
  const n = levelOf(word);
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12 }}>
      <Box sx={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '1px',
              bgcolor: i <= n ? levelColor(n) : colors.blankDay,
              border: i <= n ? 'none' : `1px solid ${colors.divider}`,
            }}
          />
        ))}
      </Box>
      {withLabel && <Box sx={{ color: colors.textSecondary }}>{levelName(n)}</Box>}
    </Box>
  );
};

export const LeechFlag: React.FC<{ word: Word; full?: boolean }> = ({ word, full }) => {
  const ds = leechDirections(word);
  if (ds.length === 0) return null;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: 12,
        fontWeight: 600,
        color: colors.warningText,
      }}
    >
      <WarningAmberRoundedIcon sx={{ fontSize: 15 }} />
      {full
        ? `${protoCopy.leech}: ${ds.map((d) => DIRECTION_LABELS[d]).join(', ')}`
        : protoCopy.leech}
    </Box>
  );
};

/** Everything about one word, and what the learner can do to it. */
export const WordDetail: React.FC<{ word: Word; bank: BankProps; onDone?: () => void }> = ({
  word,
  bank,
  onDone,
}) => {
  const targets = bank.lists.filter((l) => l.id !== (word.listId ?? 'default'));
  return (
    <Box sx={{ ...font, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box lang="zh" sx={hanziSx(48)}>
          {word[bank.charSet]}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box lang="zh-Latn" sx={{ fontSize: 17 }}>
            {word.pinyin}
          </Box>
          <LevelPip word={word} withLabel />
        </Box>
        <IconButton aria-label={protoCopy.play} onClick={() => bank.speak(word[bank.charSet])}>
          <VolumeUpRoundedIcon />
        </IconButton>
      </Box>
      <MeaningEditor value={meaningOf(word)} onChange={(m) => bank.setMeaning(word.id, m)} />
      <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{dueText(word)}</Box>
      <LeechFlag word={word} full />
      {targets.length > 0 && (
        <Box>
          <Overline sx={{ mb: 0.75 }}>{protoCopy.moveTo}</Overline>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {targets.map((l) => (
              <ButtonBase
                key={l.id}
                onClick={() => {
                  bank.moveWord(word.id, l.id);
                  onDone?.();
                }}
                sx={{
                  ...font,
                  height: 36,
                  px: 1.5,
                  borderRadius: 1,
                  fontSize: 14,
                  border: `1px solid ${colors.borderStrong}`,
                }}
              >
                {l.name}
              </ButtonBase>
            ))}
          </Box>
        </Box>
      )}
      <ButtonBase
        onClick={() => {
          bank.deleteWord(word.id);
          onDone?.();
        }}
        sx={{
          ...font,
          alignSelf: 'flex-start',
          height: 40,
          px: 0,
          fontSize: 14,
          fontWeight: 600,
          color: colors.primaryLight,
        }}
      >
        {protoCopy.remove}
      </ButtonBase>
    </Box>
  );
};

// ---------------------------------------------------------------- lists

/** A name prompt for a new list or a rename. */
export const ListNameDialog: React.FC<{
  open: boolean;
  title: string;
  initial?: string;
  action: string;
  onClose: () => void;
  onSave: (name: string) => void;
}> = ({ open, title, initial = '', action, onClose, onSave }) => {
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [initial, open]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box
        component="form"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
        sx={{ ...font, p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Box sx={{ fontSize: 18, fontWeight: 600 }}>{title}</Box>
        <InputBase
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={protoCopy.listName}
          inputProps={{ 'aria-label': protoCopy.listName, maxLength: 50 }}
          sx={{
            ...font,
            height: 48,
            px: 1.5,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 1,
          }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <StudyButton onClick={onClose}>{protoCopy.cancel}</StudyButton>
          <StudyButton
            variant="primary"
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave(name.trim())}
          >
            {action}
          </StudyButton>
        </Box>
      </Box>
    </Dialog>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body: string;
  action: string;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ open, title, body, action, onClose, onConfirm }) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
    <Box sx={{ ...font, p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ fontSize: 18, fontWeight: 600 }}>{title}</Box>
      <Box sx={{ fontSize: 15, color: colors.textSecondary }}>{body}</Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <StudyButton onClick={onClose}>{protoCopy.cancel}</StudyButton>
        <StudyButton
          variant="primary"
          onClick={onConfirm}
          sx={{ bgcolor: colors.primaryLight, '&:hover': { bgcolor: colors.primaryLightHover } }}
        >
          {action}
        </StudyButton>
      </Box>
    </Box>
  </Dialog>
);

// ---------------------------------------------------------------- misc

export const Toast: React.FC<{ bank: BankProps }> = ({ bank }) => (
  <Snackbar
    open={!!bank.toast}
    message={bank.toast}
    autoHideDuration={2200}
    onClose={bank.clearToast}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
  />
);

/** A grey block in place of a word that is due soon. */
export const HiddenBlock: React.FC<{ width: number; height?: number }> = ({
  width,
  height = 12,
}) => (
  <Box
    aria-hidden
    sx={{ width, height, borderRadius: '2px', bgcolor: colors.skeleton, flex: 'none' }}
  />
);

export const cardSx = {
  bgcolor: colors.card,
  border: `1px solid ${colors.divider}`,
  borderRadius: 1,
  boxShadow: shadows.card,
} as const;
