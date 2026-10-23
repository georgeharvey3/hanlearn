// PROTOTYPE (#405) variant A, "Search first": one search field on top does
// both jobs. Typing filters the bank and asks the dictionary at once, so the
// results replace the word list in place: no confirm modal, no clash modal, no
// "not found" modal. Lists are chips under the field. A word row opens in
// place to edit it. Throwaway.
import React, { useMemo, useState } from 'react';
import { Box, ButtonBase, IconButton, Menu, MenuItem } from '@mui/material';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import { Overline, StudyButton, hanziSx } from '../../Test/Study/parts';
import { colors, fonts } from '../../../theme';
import { Word } from '../../../types/models';
import {
  ALL_LISTS,
  BankProps,
  SUGGESTIONS,
  SWITCHER_GAP,
  activeListName,
  dueCount,
  inList,
  isHidden,
  matchesBank,
  meaningOf,
  protoCopy,
  wordsOf,
} from './shared';
import {
  ConfirmDialog,
  HiddenBlock,
  LeechFlag,
  LevelPip,
  ListNameDialog,
  SearchField,
  SearchResults,
  Toast,
  WordDetail,
} from './parts';

const font = { fontFamily: fonts.body, textAlign: 'left' } as const;

const ListChips: React.FC<{ bank: BankProps; onNew: () => void }> = ({ bank, onNew }) => {
  const chips = [
    { id: ALL_LISTS, name: protoCopy.allLists },
    ...bank.lists.map((l) => ({ id: l.id, name: l.name })),
  ];
  return (
    <Box
      role="tablist"
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        mx: -2,
        px: 2,
        py: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {chips.map((c) => {
        const on = c.id === bank.activeListId;
        const n = bank.words.filter((w) => inList(w, c.id)).length;
        return (
          <ButtonBase
            key={c.id}
            role="tab"
            aria-selected={on}
            onClick={() => bank.switchList(c.id)}
            sx={{
              ...font,
              flex: 'none',
              height: 36,
              px: 1.5,
              gap: 0.75,
              borderRadius: 1,
              fontSize: 14,
              fontWeight: on ? 600 : 400,
              border: `1px solid ${on ? colors.primaryDark : colors.borderStrong}`,
              bgcolor: on ? colors.successSurface : colors.card,
              color: on ? colors.primaryDark : colors.text,
            }}
          >
            {c.name}
            <Box component="span" sx={{ color: colors.textSecondary, fontWeight: 400 }}>
              {n}
            </Box>
          </ButtonBase>
        );
      })}
      <ButtonBase
        onClick={onNew}
        aria-label={protoCopy.newList}
        sx={{
          flex: 'none',
          width: 36,
          height: 36,
          borderRadius: 1,
          border: `1px dashed ${colors.borderStrong}`,
          color: colors.textSecondary,
        }}
      >
        <AddRoundedIcon fontSize="small" />
      </ButtonBase>
    </Box>
  );
};

const WordRow: React.FC<{ word: Word; bank: BankProps; open: boolean; onToggle: () => void }> = ({
  word,
  bank,
  open,
  onToggle,
}) => {
  const [shown, setShown] = useState(false);
  const hidden = isHidden(word) && !shown;
  return (
    <Box sx={{ borderBottom: `1px solid ${colors.divider}` }}>
      <ButtonBase
        onClick={hidden ? () => setShown(true) : onToggle}
        aria-expanded={open}
        aria-label={hidden ? `${protoCopy.dueSoon}. ${protoCopy.show}` : undefined}
        sx={{ ...font, width: '100%', display: 'flex', gap: 1.5, py: 1.25, textAlign: 'left' }}
      >
        {hidden ? (
          <>
            <HiddenBlock width={48} height={28} />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <HiddenBlock width={72} />
              <HiddenBlock width={140} height={10} />
            </Box>
            <Box sx={{ fontSize: 12, color: colors.textSecondary }}>{protoCopy.dueSoon}</Box>
          </>
        ) : (
          <>
            <Box lang="zh" sx={hanziSx(28, { minWidth: 48 })}>
              {word[bank.charSet]}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
                {word.pinyin}
              </Box>
              <Box
                sx={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {meaningOf(word)}
              </Box>
              <LeechFlag word={word} />
            </Box>
            <Box
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}
            >
              <LevelPip word={word} />
              <ExpandMoreRoundedIcon
                sx={{
                  fontSize: 18,
                  color: colors.textSecondary,
                  transform: open ? 'rotate(180deg)' : 'none',
                }}
              />
            </Box>
          </>
        )}
      </ButtonBase>
      {open && !hidden && (
        <Box sx={{ pb: 2, pl: { xs: 0, sm: 7.5 } }}>
          <WordDetail word={word} bank={bank} onDone={onToggle} />
        </Box>
      )}
    </Box>
  );
};

const VariantA: React.FC<{ bank: BankProps }> = ({ bank }) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | null>(null);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);

  const listWords = wordsOf(bank);
  const searching = bank.query.trim().length > 0;
  const bankMatches = useMemo(
    () => (searching ? bank.words.filter((w) => matchesBank(w, bank.query) && !isHidden(w)) : []),
    [bank.words, bank.query, searching],
  );
  const due = dueCount(listWords);
  const canEditList = bank.activeListId !== ALL_LISTS && bank.activeListId !== 'default';
  const name = activeListName(bank);

  return (
    <Box
      sx={{ ...font, maxWidth: 640, mx: 'auto', pb: `${SWITCHER_GAP + 72}px`, color: colors.text }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 48, md: 0 },
          zIndex: 5,
          bgcolor: colors.paper,
          pt: 1,
          pb: 1,
        }}
      >
        <SearchField bank={bank} />
        {!searching && (
          <Box sx={{ mt: 1.5 }}>
            <ListChips bank={bank} onNew={() => setDialog('new')} />
          </Box>
        )}
      </Box>

      {searching ? (
        <Box sx={{ mt: 1 }}>
          <Overline sx={{ mb: 0.5 }}>{protoCopy.results(bank.results.length)}</Overline>
          <SearchResults bank={bank} />
          {bankMatches.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Overline sx={{ mb: 0.5 }}>{protoCopy.inBank}</Overline>
              {bankMatches.map((w) => (
                <WordRow
                  key={w.id}
                  word={w}
                  bank={bank}
                  open={openId === w.id}
                  onToggle={() => setOpenId(openId === w.id ? null : w.id)}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : listWords.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box lang="zh" sx={hanziSx(64, { color: colors.outline, mb: 2 })}>
            字
          </Box>
          <Box sx={{ fontSize: 18, fontWeight: 600 }}>
            {bank.words.length === 0 ? protoCopy.emptyTitle : protoCopy.emptyList}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2 }}>
            {SUGGESTIONS.map((s) => (
              <ButtonBase
                key={s}
                lang="zh"
                onClick={() => bank.setQuery(s)}
                sx={{
                  ...hanziSx(20),
                  height: 40,
                  px: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${colors.borderStrong}`,
                }}
              >
                {s}
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5, mb: 0.5 }}>
            <Overline sx={{ flex: 1 }}>
              {name} · {protoCopy.words(listWords.length)}
            </Overline>
            {canEditList && (
              <IconButton
                size="small"
                aria-label={protoCopy.more}
                onClick={(e) => setMenuEl(e.currentTarget)}
              >
                <MoreHorizRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          {listWords.map((w) => (
            <WordRow
              key={w.id}
              word={w}
              bank={bank}
              open={openId === w.id}
              onToggle={() => setOpenId(openId === w.id ? null : w.id)}
            />
          ))}
        </Box>
      )}

      {!searching && listWords.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: { xs: 64 + 52, md: 56 },
            display: 'flex',
            justifyContent: 'center',
            px: 2,
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          <StudyButton
            variant="primary"
            disabled={due === 0}
            onClick={bank.onStudy}
            sx={{
              maxWidth: 360,
              pointerEvents: 'auto',
              boxShadow: '0 8px 20px -10px rgba(0,0,0,.4)',
            }}
          >
            {due > 0 ? protoCopy.studyDue(due) : protoCopy.study}
          </StudyButton>
        </Box>
      )}

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
        body={protoCopy.deleteListBody(listWords.length)}
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

export default VariantA;
