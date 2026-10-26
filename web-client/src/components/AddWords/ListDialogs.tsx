import React, { useId, useState } from 'react';
import { Box, ButtonBase, Checkbox, Dialog, FormControlLabel, InputBase } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts, scrim, shadows } from '../../theme';
import { WordList } from '../../types/models';

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
}> = ({ open, title, onClose, children }) => {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
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
        <Box component="h2" id={titleId} sx={{ m: 0, fontSize: 22, fontWeight: 600 }}>
          {title}
        </Box>
        {children}
      </Box>
    </Dialog>
  );
};

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

const ConfirmDelete: React.FC<{
  open: boolean;
  title: string;
  body: string | null;
  onClose: () => void;
  onDelete: () => void;
}> = ({ open, title, body, onClose, onDelete }) => (
  <Frame open={open} title={title} onClose={onClose}>
    {body && (
      <Box component="p" sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}>
        {body}
      </Box>
    )}
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

/**
 * Delete a list. `words` is the number of its words that are in no other list:
 * those go with it, and the others stay in their other lists.
 */
export const DeleteListDialog: React.FC<{
  open: boolean;
  name: string;
  words: number;
  onClose: () => void;
  onDelete: () => void;
}> = ({ name, words, ...dialog }) => (
  <ConfirmDelete
    {...dialog}
    title={copy.wordBank.deleteTitle(name)}
    body={words > 0 ? copy.wordBank.deleteBody(words) : null}
  />
);

/** Delete a word that no other list holds. Its schedule goes with it. */
export const DeleteWordDialog: React.FC<{
  open: boolean;
  label: string;
  onClose: () => void;
  onDelete: () => void;
}> = ({ label, ...dialog }) => (
  <ConfirmDelete
    {...dialog}
    title={copy.wordBank.deleteWord(label)}
    body={copy.wordBank.deleteWordBody}
  />
);

interface ListsFormProps {
  lists: WordList[];
  initial: string[];
  onClose: () => void;
  onSave: (listIds: string[]) => void;
}

const ListsForm: React.FC<ListsFormProps> = ({ lists, initial, onClose, onSave }) => {
  const [checked, setChecked] = useState<string[]>(initial);
  const toggle = (id: string) =>
    setChecked((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  return (
    <Box
      component="form"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        onSave(lists.map((l) => l.id).filter((id) => checked.includes(id)));
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {lists.map((list) => {
          const on = checked.includes(list.id);
          return (
            <FormControlLabel
              key={list.id}
              label={list.name}
              control={
                <Checkbox
                  checked={on}
                  // Every word is in at least one list, so the last box stays.
                  disabled={on && checked.length === 1}
                  onChange={() => toggle(list.id)}
                />
              }
              sx={{
                minHeight: 44,
                m: 0,
                '& .MuiFormControlLabel-label': { fontFamily: fonts.body, fontSize: 16 },
              }}
            />
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
        <ButtonBase onClick={onClose} sx={cancelSx}>
          {copy.wordBank.cancel}
        </ButtonBase>
        <ButtonBase type="submit" disabled={checked.length === 0} sx={actionSx(false)}>
          {copy.wordBank.save}
        </ButtonBase>
      </Box>
    </Box>
  );
};

/** The lists that hold one word, one box for each list. */
export const ListsOfWordDialog: React.FC<ListsFormProps & { open: boolean; label: string }> = ({
  open,
  label,
  ...form
}) => (
  <Frame open={open} title={copy.wordBank.listsOf(label)} onClose={form.onClose}>
    {/* Each opening starts from the lists the word is in now. */}
    <ListsForm key={`${open}-${form.initial.join()}`} {...form} />
  </Frame>
);
