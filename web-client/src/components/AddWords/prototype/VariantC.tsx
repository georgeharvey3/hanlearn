// PROTOTYPE (#405) variant C, "Character wall": the bank is a grid of
// character tiles, inked by level, so the learner sees the shape of the whole
// collection at once. A tile due soon is a blank square. A tap on a tile opens
// the word in a sheet. The search lives in a dock at the foot, in thumb
// reach, and its results rise over the wall. Filters on top: all, hard, new,
// mastered. The list is a drop-down in the header. Throwaway.
import React, { useState } from 'react';
import {
  Box,
  ButtonBase,
  ClickAwayListener,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Paper,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { StudyButton, hanziSx } from '../../Test/Study/parts';
import { colors, fonts } from '../../../theme';
import { Word } from '../../../types/models';
import {
  ALL_LISTS,
  BankProps,
  SUGGESTIONS,
  activeListName,
  dueCount,
  inList,
  isHidden,
  isLeechWord,
  levelColor,
  levelOf,
  protoCopy,
  wordsOf,
} from './shared';
import {
  ConfirmDialog,
  ListNameDialog,
  SearchField,
  SearchResults,
  Toast,
  WordDetail,
} from './parts';

const font = { fontFamily: fonts.body, textAlign: 'left' } as const;

type Filter = 'all' | 'hard' | 'new' | 'mastered';

const FILTERS: { key: Filter; label: string; test: (w: Word) => boolean }[] = [
  { key: 'all', label: protoCopy.all, test: () => true },
  { key: 'hard', label: protoCopy.leeches, test: isLeechWord },
  { key: 'new', label: 'New', test: (w) => levelOf(w) === 1 },
  { key: 'mastered', label: 'Mastered', test: (w) => levelOf(w) === 5 },
];

const Tile: React.FC<{ word: Word; bank: BankProps; onOpen: () => void }> = ({
  word,
  bank,
  onOpen,
}) => {
  if (isHidden(word)) {
    return (
      <Box
        aria-label={protoCopy.dueSoon}
        sx={{
          aspectRatio: '1',
          borderRadius: 1,
          border: `1px dashed ${colors.borderStrong}`,
          bgcolor: colors.blankDay,
        }}
      />
    );
  }
  const n = levelOf(word);
  const text = word[bank.charSet];
  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={text}
      sx={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 1,
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        overflow: 'hidden',
        flexDirection: 'column',
      }}
    >
      <Box lang="zh" sx={hanziSx(text.length <= 2 ? 30 : text.length === 3 ? 22 : 17)}>
        {text}
      </Box>
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 5,
          bgcolor: levelColor(n),
        }}
      />
      {isLeechWord(word) && (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: '4px',
            bgcolor: colors.warning,
          }}
        />
      )}
    </ButtonBase>
  );
};

const VariantC: React.FC<{ bank: BankProps }> = ({ bank }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [openWord, setOpenWord] = useState<Word | null>(null);
  const [listEl, setListEl] = useState<HTMLElement | null>(null);
  const [moreEl, setMoreEl] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | null>(null);
  const [docked, setDocked] = useState(!bank.query);

  const words = wordsOf(bank);
  const test = FILTERS.find((f) => f.key === filter)!.test;
  // Hidden tiles stay in the "all" wall only: a filter would tell which words they are.
  const shown = filter === 'all' ? words : words.filter((w) => !isHidden(w) && test(w));
  const due = dueCount(words);
  const name = activeListName(bank);
  const canEdit = bank.activeListId !== ALL_LISTS && bank.activeListId !== 'default';
  const current = openWord && bank.words.find((w) => w.id === openWord.id);
  const searching = !docked || !!bank.query.trim();

  return (
    <Box sx={{ ...font, maxWidth: 900, mx: 'auto', pb: '220px', color: colors.text }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonBase
          onClick={(e) => setListEl(e.currentTarget)}
          aria-haspopup="menu"
          sx={{ ...font, fontSize: 22, fontWeight: 600, gap: 0.5, height: 44 }}
        >
          {name}
          <ExpandMoreRoundedIcon />
        </ButtonBase>
        <Box sx={{ flex: 1, fontSize: 14, color: colors.textSecondary }}>{words.length}</Box>
        {canEdit && (
          <IconButton aria-label={protoCopy.more} onClick={(e) => setMoreEl(e.currentTarget)}>
            <MoreHorizRoundedIcon />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, my: 1.5 }}>
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <ButtonBase
              key={f.key}
              aria-pressed={on}
              onClick={() => setFilter(f.key)}
              sx={{
                ...font,
                height: 32,
                px: 1.25,
                borderRadius: 1,
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                bgcolor: on ? colors.text : 'transparent',
                color: on ? colors.white : colors.text,
                border: `1px solid ${on ? colors.text : colors.borderStrong}`,
              }}
            >
              {f.label}
            </ButtonBase>
          );
        })}
      </Box>

      {words.length === 0 ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            position: 'relative',
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <Box
              key={i}
              sx={{ aspectRatio: '1', borderRadius: 1, border: `1px dashed ${colors.divider}` }}
            />
          ))}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ fontSize: 18, fontWeight: 600, bgcolor: colors.paper, px: 1 }}>
              {bank.words.length === 0 ? protoCopy.emptyTitle : protoCopy.emptyList}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {SUGGESTIONS.map((s) => (
                <ButtonBase
                  key={s}
                  lang="zh"
                  onClick={() => {
                    setDocked(false);
                    bank.setQuery(s);
                  }}
                  sx={{
                    ...hanziSx(20),
                    height: 40,
                    px: 1.5,
                    borderRadius: 1,
                    bgcolor: colors.card,
                    border: `1px solid ${colors.borderStrong}`,
                  }}
                >
                  {s}
                </ButtonBase>
              ))}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(4, 1fr)',
              sm: 'repeat(6, 1fr)',
              md: 'repeat(8, 1fr)',
            },
            gap: 1,
          }}
        >
          {shown.map((w) => (
            <Tile key={w.id} word={w} bank={bank} onOpen={() => setOpenWord(w)} />
          ))}
        </Box>
      )}

      {/* The dock: the search field, and Study beside it. */}
      <ClickAwayListener
        onClickAway={() => {
          if (!bank.query.trim()) setDocked(true);
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(560px, calc(100% - 16px))',
            boxSizing: 'border-box',
            bottom: { xs: 64 + 52, md: 56 },
            zIndex: 1200,
            p: 1,
            borderRadius: 1,
            border: `1px solid ${colors.divider}`,
            boxShadow: '0 -8px 32px -12px rgba(70,50,30,.35)',
            bgcolor: colors.paper,
            maxHeight: searching ? '62vh' : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {searching && bank.query.trim() && (
            <Box sx={{ overflowY: 'auto', px: 1, mb: 1 }}>
              <SearchResults bank={bank} dense />
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <SearchField
              bank={bank}
              onFocus={() => setDocked(false)}
              sx={{ flex: 1, height: 48 }}
            />
            {!searching && (
              <StudyButton
                variant="primary"
                disabled={due === 0}
                onClick={bank.onStudy}
                sx={{ width: 'auto', flex: 'none', px: 2, height: 48 }}
              >
                {due > 0 ? protoCopy.studyDue(due) : protoCopy.study}
              </StudyButton>
            )}
          </Box>
        </Paper>
      </ClickAwayListener>

      <Drawer
        anchor="bottom"
        open={!!current}
        onClose={() => setOpenWord(null)}
        PaperProps={{
          sx: {
            ...font,
            mx: 'auto',
            width: '100%',
            maxWidth: 560,
            boxSizing: 'border-box',
            borderRadius: 1,
            p: 2.5,
          },
        }}
      >
        {current && <WordDetail word={current} bank={bank} onDone={() => setOpenWord(null)} />}
      </Drawer>

      <Menu anchorEl={listEl} open={!!listEl} onClose={() => setListEl(null)}>
        {[{ id: ALL_LISTS, name: protoCopy.allLists }, ...bank.lists].map((l) => {
          const ws = bank.words.filter((w) => inList(w, l.id));
          return (
            <MenuItem
              key={l.id}
              selected={l.id === bank.activeListId}
              onClick={() => {
                bank.switchList(l.id);
                setListEl(null);
              }}
              sx={{ gap: 2, minWidth: 220 }}
            >
              <Box sx={{ width: 20 }}>
                {l.id === bank.activeListId && <CheckRoundedIcon fontSize="small" />}
              </Box>
              <Box sx={{ flex: 1 }}>{l.name}</Box>
              <Box sx={{ fontSize: 13, color: colors.textSecondary }}>
                {dueCount(ws) > 0 ? protoCopy.due(dueCount(ws)) : ws.length}
              </Box>
            </MenuItem>
          );
        })}
        <MenuItem
          onClick={() => {
            setListEl(null);
            setDialog('new');
          }}
          sx={{ color: colors.primaryDark, fontWeight: 600 }}
        >
          <Box sx={{ width: 20, mr: 2 }} />
          {protoCopy.newList}
        </MenuItem>
      </Menu>
      <Menu anchorEl={moreEl} open={!!moreEl} onClose={() => setMoreEl(null)}>
        <MenuItem onClick={() => (setMoreEl(null), setDialog('rename'))}>
          {protoCopy.rename}
        </MenuItem>
        <MenuItem
          onClick={() => (setMoreEl(null), setDialog('delete'))}
          sx={{ color: colors.primaryLight }}
        >
          {protoCopy.delete}
        </MenuItem>
      </Menu>
      <ListNameDialog
        open={dialog === 'new' || dialog === 'rename'}
        title={dialog === 'rename' ? protoCopy.rename : protoCopy.newList}
        initial={dialog === 'rename' ? name : ''}
        action={dialog === 'rename' ? protoCopy.save : protoCopy.create}
        onClose={() => setDialog(null)}
        onSave={(n) => {
          if (dialog === 'rename') bank.renameList(bank.activeListId, n);
          else bank.createList(n);
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
        }}
      />
      <Toast bank={bank} />
    </Box>
  );
};

export default VariantC;
