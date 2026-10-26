import React, { useCallback, useEffect, useId, useState } from 'react';
import { Box, ButtonBase, Checkbox, Dialog, FormControlLabel, InputBase } from '@mui/material';

import { Overline } from '../Test/Study/parts';
import { copy } from '../../copy';
import { colors, fonts, scrim, shadows } from '../../theme';
import { WordList } from '../../types/models';
import { loadCatalogue, loadPremadeEntries, PremadeList } from '../../services/premadeListService';

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

type Catalogue = PremadeList[] | 'loading' | 'error';

/** The premade lists, loaded when the first component that shows them mounts. */
function useCatalogue(): { catalogue: Catalogue; retry: () => void } {
  const [catalogue, setCatalogue] = useState<Catalogue>('loading');
  // Each attempt loads once; Retry starts the next.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadCatalogue().then(
      (lists) => live && setCatalogue(lists),
      () => live && setCatalogue('error'),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setCatalogue('loading');
    setAttempt((n) => n + 1);
  }, []);
  return { catalogue, retry };
}

/** The catalogue: one row for each premade list, with its size. */
export const PremadeLists: React.FC<{ onPick: (list: PremadeList) => void }> = ({ onPick }) => {
  const { catalogue, retry } = useCatalogue();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Overline component="h2" sx={{ m: 0, mb: 0.5 }}>
        {copy.premadeLists.heading}
      </Overline>
      {catalogue === 'loading' && (
        <Box role="status" aria-label={copy.wordBank.loading} sx={{ height: 48 }} />
      )}
      {catalogue === 'error' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48 }}>
          <Box component="span" sx={{ flex: 1, fontSize: 15, color: colors.textSecondary }}>
            {copy.premadeLists.loadFailed}
          </Box>
          <ButtonBase onClick={retry} sx={cancelSx}>
            {copy.wordBank.retry}
          </ButtonBase>
        </Box>
      )}
      {Array.isArray(catalogue) &&
        catalogue.map((list) => (
          <ButtonBase
            key={list.id}
            onClick={() => onPick(list)}
            sx={{
              minHeight: 48,
              px: 0.5,
              borderBottom: `1px solid ${colors.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1.5,
              fontFamily: fonts.body,
              fontSize: 16,
              color: colors.text,
              textAlign: 'left',
            }}
          >
            <span>{list.name}</span>
            <Box component="span" sx={{ fontSize: 14, color: colors.textSecondary }}>
              {copy.premadeLists.size(list.size)}
            </Box>
          </ButtonBase>
        ))}
    </Box>
  );
};

interface PremadeFormProps {
  list: PremadeList;
  /** How many of these words the learner has. */
  countHeld: (wordIds: number[]) => Promise<number>;
  /** Resolves to whether the list was added. */
  onAdd: (list: PremadeList) => Promise<boolean>;
  onClose: () => void;
}

/** The size of a premade list and how many of its words the learner has, then Add. */
const PremadeForm: React.FC<PremadeFormProps> = ({ list, countHeld, onAdd, onClose }) => {
  const [held, setHeld] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    loadPremadeEntries(list.id)
      .then((entries) => countHeld(entries.map((entry) => entry.id)))
      .then(
        (count) => live && setHeld(count),
        // The count is only shown: without it the learner can still add the list.
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [list.id, countHeld]);

  const add = async () => {
    setAdding(true);
    const added = await onAdd(list);
    setAdding(false);
    if (added) onClose();
  };

  return (
    <>
      <Box component="p" sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}>
        {held === null
          ? copy.premadeLists.confirmSize(list.size)
          : copy.premadeLists.confirmHeld(list.size, held)}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
        <ButtonBase onClick={onClose} disabled={adding} sx={cancelSx}>
          {copy.wordBank.cancel}
        </ButtonBase>
        <ButtonBase onClick={add} disabled={adding} sx={actionSx(false)}>
          {adding ? copy.premadeLists.adding : copy.premadeLists.add}
        </ButtonBase>
      </Box>
    </>
  );
};

/**
 * A new list: an empty one with a name, or one made from a premade list of the
 * catalogue. With `premade`, the dialog shows the confirmation of that list.
 */
export const NewListDialog: React.FC<
  Omit<PremadeFormProps, 'list'> & {
    open: boolean;
    premade: PremadeList | null;
    onPick: (list: PremadeList) => void;
    onCreate: (name: string) => void;
  }
> = ({ open, premade, onPick, onCreate, onClose, ...form }) => {
  return (
    <Frame open={open} title={premade ? premade.name : copy.wordBank.newList} onClose={onClose}>
      {premade ? (
        <PremadeForm key={premade.id} list={premade} onClose={onClose} {...form} />
      ) : (
        <>
          <NameForm
            key={String(open)}
            initial=""
            action={copy.wordBank.create}
            onClose={onClose}
            onSave={onCreate}
          />
          <PremadeLists onPick={onPick} />
        </>
      )}
    </Frame>
  );
};

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
