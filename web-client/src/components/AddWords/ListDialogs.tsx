import React, { useState } from 'react';
import { Box, ButtonBase, Dialog, InputBase } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts, scrim, shadows } from '../../theme';

const buttonSx = {
  height: 44,
  px: 2.5,
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 15,
  fontWeight: 600,
} as const;

const cancelSx = { ...buttonSx, border: `1px solid ${colors.borderStrong}`, color: colors.text };

const actionSx = (danger: boolean) => ({
  ...buttonSx,
  color: colors.white,
  bgcolor: danger ? colors.primaryLight : colors.primaryDark,
  '&:hover': { bgcolor: danger ? colors.primaryLightHover : colors.primaryDarkHover },
  '&.Mui-disabled': { bgcolor: colors.divider, color: colors.textSecondary },
});

const Frame: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => (
  <Dialog
    open={open}
    onClose={onClose}
    aria-label={title}
    PaperProps={{
      sx: {
        width: 340,
        maxWidth: 'calc(100% - 32px)',
        m: 2,
        borderRadius: 1,
        boxShadow: shadows.dialog,
      },
    }}
    slotProps={{ backdrop: { sx: { bgcolor: scrim } } }}
  >
    <Box
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      <Box component="h2" sx={{ m: 0, fontSize: 22, fontWeight: 600 }}>
        {title}
      </Box>
      {children}
    </Box>
  </Dialog>
);

interface NameFormProps {
  initial: string;
  action: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

const NameForm: React.FC<NameFormProps> = ({ initial, action, onClose, onSave }) => {
  const [name, setName] = useState(initial);
  const ready = name.trim().length > 0;
  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        if (ready) onSave(name.trim());
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <InputBase
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={copy.wordBank.listName}
        inputProps={{ 'aria-label': copy.wordBank.listName, maxLength: 50 }}
        sx={{
          height: 48,
          boxSizing: 'border-box',
          px: '13px',
          borderRadius: 1,
          border: `1px solid ${colors.borderStrong}`,
          fontFamily: fonts.body,
          fontSize: 16,
          '&.Mui-focused': { border: `2px solid ${colors.primaryDark}`, px: '12px' },
        }}
      />
      <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
        <ButtonBase onClick={onClose} sx={cancelSx}>
          {copy.wordBank.cancel}
        </ButtonBase>
        <ButtonBase type="submit" disabled={!ready} sx={actionSx(false)}>
          {action}
        </ButtonBase>
      </Box>
    </Box>
  );
};

/** The name of a new list, or the new name of a list. */
export const ListNameDialog: React.FC<NameFormProps & { open: boolean; title: string }> = ({
  open,
  title,
  ...form
}) => (
  <Frame open={open} title={title} onClose={form.onClose}>
    {/* Each opening starts from the initial name. */}
    <NameForm key={`${open}-${form.initial}`} {...form} />
  </Frame>
);

/** Delete a list. Its words go with it. */
export const DeleteListDialog: React.FC<{
  open: boolean;
  name: string;
  words: number;
  onClose: () => void;
  onDelete: () => void;
}> = ({ open, name, words, onClose, onDelete }) => (
  <Frame open={open} title={copy.wordBank.deleteTitle(name)} onClose={onClose}>
    <Box component="p" sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}>
      {copy.wordBank.deleteBody(words)}
    </Box>
    <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
      <ButtonBase onClick={onClose} sx={cancelSx}>
        {copy.wordBank.cancel}
      </ButtonBase>
      <ButtonBase onClick={onDelete} sx={actionSx(true)}>
        {copy.wordBank.delete}
      </ButtonBase>
    </Box>
  </Frame>
);
