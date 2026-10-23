// PROTOTYPE (#405) variant B, "Lists first": the page opens on the lists, not
// on the words. Each list is a card with its size, its due count and a bar of
// its levels. A tap opens the list: its words grouped by level, the hard ones
// first. Words due soon fold into one row with a count and never open. Adding
// a word is a sheet from the "Add word" button, which adds to the open list.
// Throwaway.
import React, { useState } from 'react';
import { Box, ButtonBase, Drawer, IconButton, Menu, MenuItem } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';

import { Overline, StudyButton, hanziSx } from '../../Test/Study/parts';
import { colors, fonts } from '../../../theme';
import { Word } from '../../../types/models';
import {
  ALL_LISTS,
  BankProps,
  SWITCHER_GAP,
  activeListName,
  dueCount,
  inList,
  isHidden,
  isLeechWord,
  levelColor,
  levelName,
  levelOf,
  meaningOf,
  protoCopy,
  wordsOf,
} from './shared';
import {
  ConfirmDialog,
  LeechFlag,
  ListNameDialog,
  SearchField,
  SearchResults,
  Toast,
  WordDetail,
  cardSx,
} from './parts';

const font = { fontFamily: fonts.body, textAlign: 'left' } as const;

const sheetPaper = {
  ...font,
  m: { xs: 0, sm: 2 },
  mx: 'auto',
  width: { xs: '100%', sm: 'calc(100% - 32px)' },
  maxWidth: 560,
  maxHeight: '88vh',
  boxSizing: 'border-box',
  borderRadius: 1,
  p: 2.5,
  color: colors.text,
} as const;

const LevelBar: React.FC<{ words: Word[] }> = ({ words }) => (
  <Box
    sx={{
      display: 'flex',
      height: 8,
      borderRadius: '2px',
      overflow: 'hidden',
      bgcolor: colors.blankDay,
    }}
  >
    {[1, 2, 3, 4, 5].map((n) => {
      const c = words.filter((w) => levelOf(w) === n).length;
      return c > 0 ? <Box key={n} sx={{ flex: c, bgcolor: levelColor(n) }} /> : null;
    })}
  </Box>
);

const ListCard: React.FC<{ name: string; words: Word[]; onOpen: () => void }> = ({
  name,
  words,
  onOpen,
}) => {
  const due = dueCount(words);
  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        ...cardSx,
        ...font,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        gap: 1.25,
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{name}</Box>
        {due > 0 && (
          <Box
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.white,
              bgcolor: colors.primaryDark,
              px: 1,
              py: 0.25,
              borderRadius: 1,
            }}
          >
            {protoCopy.due(due)}
          </Box>
        )}
        <ChevronRightRoundedIcon sx={{ color: colors.textSecondary }} />
      </Box>
      <LevelBar words={words} />
      <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{protoCopy.words(words.length)}</Box>
    </ButtonBase>
  );
};

const WordLine: React.FC<{ word: Word; bank: BankProps; onOpen: () => void }> = ({
  word,
  bank,
  onOpen,
}) => (
  <ButtonBase
    onClick={onOpen}
    sx={{
      ...font,
      width: '100%',
      display: 'flex',
      gap: 1.5,
      py: 1.25,
      textAlign: 'left',
      borderBottom: `1px solid ${colors.divider}`,
    }}
  >
    <Box lang="zh" sx={hanziSx(26, { minWidth: 56 })}>
      {word[bank.charSet]}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ fontSize: 14 }}>
        <Box component="span" lang="zh-Latn">
          {word.pinyin}
        </Box>
        <Box component="span" sx={{ color: colors.textSecondary }}>
          {' '}
          · {meaningOf(word)}
        </Box>
      </Box>
      <LeechFlag word={word} />
    </Box>
  </ButtonBase>
);

const Group: React.FC<{
  title: string;
  ink?: string;
  count: number;
  children: React.ReactNode;
}> = ({ title, ink, count, children }) => (
  <Box sx={{ mt: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      {ink && <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: ink }} />}
      <Overline sx={{ flex: 1 }}>{title}</Overline>
      <Box sx={{ fontSize: 12, color: colors.textSecondary }}>{count}</Box>
    </Box>
    {children}
  </Box>
);

const ListView: React.FC<{ bank: BankProps; onBack: () => void; onAdd: () => void }> = ({
  bank,
  onBack,
  onAdd,
}) => {
  const [openWord, setOpenWord] = useState<Word | null>(null);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const words = wordsOf(bank);
  const name = activeListName(bank);
  const hidden = words.filter(isHidden);
  const visible = words.filter((w) => !isHidden(w));
  const hard = visible.filter(isLeechWord);
  const rest = visible.filter((w) => !isLeechWord(w));
  const due = dueCount(words);
  const canEdit = bank.activeListId !== ALL_LISTS && bank.activeListId !== 'default';
  const current = openWord && bank.words.find((w) => w.id === openWord.id);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: -1 }}>
        <IconButton aria-label={protoCopy.lists} onClick={onBack}>
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box sx={{ flex: 1, fontSize: 22, fontWeight: 600 }}>{name}</Box>
        {canEdit && (
          <IconButton aria-label={protoCopy.more} onClick={(e) => setMenuEl(e.currentTarget)}>
            <MoreHorizRoundedIcon />
          </IconButton>
        )}
      </Box>
      <Box sx={{ mt: 1.5 }}>
        <LevelBar words={words} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <StudyButton variant="primary" disabled={due === 0} onClick={bank.onStudy}>
          {due > 0 ? protoCopy.studyDue(due) : protoCopy.study}
        </StudyButton>
        <StudyButton onClick={onAdd} sx={{ width: 'auto', px: 2, flex: 'none' }}>
          <AddRoundedIcon fontSize="small" /> {protoCopy.add}
        </StudyButton>
      </Box>

      {words.length === 0 && (
        <Box sx={{ py: 6, textAlign: 'center', color: colors.textSecondary }}>
          {protoCopy.emptyList}
        </Box>
      )}

      {hidden.length > 0 && (
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 1,
            border: `1px dashed ${colors.borderStrong}`,
            color: colors.textSecondary,
          }}
        >
          <LockClockOutlinedIcon />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
              {protoCopy.dueSoonCount(hidden.length)}
            </Box>
            <Box sx={{ fontSize: 13 }}>{protoCopy.hiddenNote}</Box>
          </Box>
        </Box>
      )}

      {hard.length > 0 && (
        <Group title={protoCopy.leech} ink={colors.warning} count={hard.length}>
          {hard.map((w) => (
            <WordLine key={w.id} word={w} bank={bank} onOpen={() => setOpenWord(w)} />
          ))}
        </Group>
      )}
      {[1, 2, 3, 4, 5].map((n) => {
        const ws = rest.filter((w) => levelOf(w) === n);
        if (ws.length === 0) return null;
        return (
          <Group key={n} title={levelName(n)} ink={levelColor(n)} count={ws.length}>
            {ws.map((w) => (
              <WordLine key={w.id} word={w} bank={bank} onOpen={() => setOpenWord(w)} />
            ))}
          </Group>
        );
      })}

      <Drawer
        anchor="bottom"
        open={!!current}
        onClose={() => setOpenWord(null)}
        PaperProps={{ sx: sheetPaper }}
      >
        {current && <WordDetail word={current} bank={bank} onDone={() => setOpenWord(null)} />}
      </Drawer>
      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={() => (setMenuEl(null), setDialog('rename'))}>
          {protoCopy.rename}
        </MenuItem>
        <MenuItem
          onClick={() => (setMenuEl(null), setDialog('delete'))}
          sx={{ color: colors.primaryLight }}
        >
          {protoCopy.delete}
        </MenuItem>
      </Menu>
      <ListNameDialog
        open={dialog === 'rename'}
        title={protoCopy.rename}
        initial={name}
        action={protoCopy.save}
        onClose={() => setDialog(null)}
        onSave={(n) => {
          bank.renameList(bank.activeListId, n);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title={protoCopy.deleteListTitle(name)}
        body={protoCopy.deleteListBody(words.length)}
        action={protoCopy.delete}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          bank.deleteList(bank.activeListId);
          setDialog(null);
          onBack();
        }}
      />
    </Box>
  );
};

const VariantB: React.FC<{ bank: BankProps; startInList?: boolean }> = ({ bank, startInList }) => {
  const [inside, setInside] = useState(!!startInList);
  const [adding, setAdding] = useState(!!bank.query);
  const [newList, setNewList] = useState(false);

  const open = (id: string) => {
    bank.switchList(id);
    setInside(true);
  };

  return (
    <Box sx={{ ...font, maxWidth: 640, mx: 'auto', pb: `${SWITCHER_GAP}px`, color: colors.text }}>
      {inside ? (
        <ListView bank={bank} onBack={() => setInside(false)} onAdd={() => setAdding(true)} />
      ) : (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{ flex: 1, fontSize: 22, fontWeight: 600 }}>{protoCopy.title}</Box>
            <StudyButton
              variant="primary"
              onClick={() => setAdding(true)}
              sx={{ width: 'auto', px: 2, height: 44 }}
            >
              <AddRoundedIcon fontSize="small" /> {protoCopy.add}
            </StudyButton>
          </Box>
          {bank.words.length === 0 ? (
            <Box sx={{ ...cardSx, p: 3, textAlign: 'center' }}>
              <Box lang="zh" sx={hanziSx(56, { color: colors.outline, mb: 1.5 })}>
                字
              </Box>
              <Box sx={{ fontSize: 18, fontWeight: 600 }}>{protoCopy.emptyTitle}</Box>
              <StudyButton variant="primary" onClick={() => setAdding(true)} sx={{ mt: 2 }}>
                {protoCopy.add}
              </StudyButton>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              {bank.lists.length > 1 && (
                <ListCard
                  name={protoCopy.allLists}
                  words={bank.words}
                  onOpen={() => open(ALL_LISTS)}
                />
              )}
              {bank.lists.map((l) => (
                <ListCard
                  key={l.id}
                  name={l.name}
                  words={bank.words.filter((w) => inList(w, l.id))}
                  onOpen={() => open(l.id)}
                />
              ))}
              <ButtonBase
                onClick={() => setNewList(true)}
                sx={{
                  ...font,
                  minHeight: 64,
                  gap: 1,
                  borderRadius: 1,
                  border: `1px dashed ${colors.borderStrong}`,
                  color: colors.textSecondary,
                  fontSize: 15,
                }}
              >
                <AddRoundedIcon fontSize="small" /> {protoCopy.newList}
              </ButtonBase>
            </Box>
          )}
        </Box>
      )}

      <Drawer
        anchor="bottom"
        open={adding}
        onClose={() => setAdding(false)}
        PaperProps={{ sx: { ...sheetPaper, minHeight: '60vh' } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ flex: 1, fontSize: 18, fontWeight: 600 }}>
            {protoCopy.add} · {activeListName(bank) || protoCopy.allLists}
          </Box>
          <ButtonBase
            onClick={() => setAdding(false)}
            sx={{ ...font, fontSize: 15, color: colors.primaryDark, fontWeight: 600, height: 40 }}
          >
            {protoCopy.close}
          </ButtonBase>
        </Box>
        <SearchField bank={bank} autoFocus />
        <Box sx={{ mt: 1, overflowY: 'auto' }}>
          {bank.query.trim() && <SearchResults bank={bank} />}
        </Box>
      </Drawer>
      <ListNameDialog
        open={newList}
        title={protoCopy.newList}
        action={protoCopy.create}
        onClose={() => setNewList(false)}
        onSave={(n) => {
          bank.createList(n);
          setNewList(false);
          setInside(true);
        }}
      />
      <Toast bank={bank} />
    </Box>
  );
};

export default VariantB;
