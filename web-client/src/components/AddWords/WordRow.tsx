import React, { useCallback, useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import MeaningEditor from '../UI/MeaningEditor/MeaningEditor';
import { Overline, hanziSx } from '../Test/Study/parts';
import { copy } from '../../copy';
import { colors, fonts, levelInk } from '../../theme';
import { Word, WordList } from '../../types/models';
import { DIRECTION_LABELS, leechDirections } from '../../utils/directions';
import { BANK_LABELS } from '../../utils/scheduling';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';
import { isCovered, listIdsOf, removalDeletes } from '../../utils/wordBank';
import { Block } from './BankStates';
import * as ttsService from '../../services/ttsService';

interface Props {
  word: Word;
  charSet: 'simp' | 'trad';
  lists: WordList[];
  activeListId: string;
  open: boolean;
  onToggle: () => void;
  onMeaningChange: (id: number, meaning: string) => void;
  onEditLists: (word: Word) => void;
  onRemove: (word: Word) => void;
}

const rowSx = {
  width: '100%',
  minHeight: 64,
  boxSizing: 'border-box',
  py: 1.5,
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  textAlign: 'left',
  fontFamily: fonts.body,
  color: colors.text,
} as const;

/** Five small squares, filled to the word's level in the level's ink. */
const LevelPips: React.FC<{ level: number }> = ({ level }) => (
  <Box
    component="span"
    role="img"
    aria-label={BANK_LABELS[level] ?? BANK_LABELS[1]}
    sx={{ display: 'flex', gap: '2px' }}
  >
    {[1, 2, 3, 4, 5].map((i) => (
      <Box
        key={i}
        component="span"
        sx={{
          width: 6,
          height: 6,
          boxSizing: 'border-box',
          borderRadius: '1px',
          bgcolor: i <= level ? levelInk[level - 1] : colors.blankDay,
          border: i <= level ? 'none' : `1px solid ${colors.divider}`,
        }}
      />
    ))}
  </Box>
);

const LeechFlag: React.FC<{ children: React.ReactNode; size: number }> = ({ children, size }) => (
  <Box
    component="span"
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      fontSize: size,
      fontWeight: 600,
      color: colors.warningText,
    }}
  >
    <WarningAmberRoundedIcon aria-hidden sx={{ fontSize: size + 2 }} />
    {children}
  </Box>
);

const actionSx = {
  height: 44,
  px: '14px',
  borderRadius: 1,
  border: `1px solid ${colors.borderStrong}`,
  fontFamily: fonts.body,
  fontSize: 14,
  color: colors.text,
} as const;

/**
 * One word of the bank. A tap opens it in place: play, the meanings, the leech
 * flag, the lists that hold it and "Remove". A word due soon shows grey blocks in place of
 * its characters, pinyin and meaning until a tap shows it.
 */
const WordRow: React.FC<Props> = ({
  word,
  charSet,
  lists,
  activeListId,
  open,
  onToggle,
  onMeaningChange,
  onEditLists,
  onRemove,
}) => {
  const [shown, setShown] = useState(false);
  const [playing, setPlaying] = useState(false);
  const covered = isCovered(word) && !shown;
  const level = word.level ?? 1;
  const levelName = BANK_LABELS[level] ?? BANK_LABELS[1];
  const label = word[charSet];
  // The directions the learner keeps failing to recall. The schedule is not
  // fixing these on its own, so the row names them and leaves what to do about
  // them to the learner. See docs/adr/0010-partial-demotion-and-leeches.md.
  const leeches = leechDirections(word);
  const listIds = listIdsOf(word);
  const listNames = lists.filter((l) => listIds.includes(l.id)).map((l) => l.name);
  const activeList = lists.find((l) => l.id === activeListId);
  // Removal from one of several lists keeps the word, so the control names the
  // list. Otherwise it deletes the word, and the bank asks first.
  const removeLabel =
    activeList && !removalDeletes(word, activeListId)
      ? copy.wordBank.removeFrom(activeList.name)
      : copy.wordBank.remove;

  const play = useCallback(() => {
    setPlaying(true);
    ttsService.speak(label, { onEnd: () => setPlaying(false), onError: () => setPlaying(false) });
  }, [label]);

  return (
    <Box sx={{ borderBottom: `1px solid ${colors.divider}` }}>
      {covered ? (
        <ButtonBase onClick={() => setShown(true)} aria-label={copy.wordBank.showWord} sx={rowSx}>
          <Block width={56} height={28} />
          <Box component="span" sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Block width={72} height={12} />
            <Block width={140} height={10} />
          </Box>
          <Box component="span" aria-hidden sx={{ fontSize: 12, color: colors.textSecondary }}>
            {copy.wordBank.dueSoon}
          </Box>
        </ButtonBase>
      ) : (
        <ButtonBase onClick={onToggle} aria-expanded={open} sx={rowSx}>
          <Box component="span" lang="zh" sx={hanziSx(28, { minWidth: 56 })}>
            {label}
          </Box>
          <Box
            component="span"
            sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}
          >
            <Box component="span" lang="zh-Latn" sx={{ fontSize: 15 }}>
              {word.pinyin}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: 13,
                color: colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {word.meaning}
            </Box>
            {leeches.length > 0 && !open && <LeechFlag size={12}>{copy.wordBank.leech}</LeechFlag>}
          </Box>
          <Box
            component="span"
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.75 }}
          >
            {shown && (
              <Box component="span" sx={{ fontSize: 12, color: colors.textSecondary }}>
                {copy.wordBank.dueSoon}
              </Box>
            )}
            <LevelPips level={level} />
            <ExpandMoreRoundedIcon
              aria-hidden
              sx={{
                fontSize: 18,
                color: colors.textSecondary,
                transform: open ? 'rotate(180deg)' : 'none',
              }}
            />
          </Box>
        </ButtonBase>
      )}
      {open && !covered && (
        <Box sx={{ pb: 2, pl: '68px', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: '-12px' }}>
            <IconButton
              onClick={play}
              disabled={playing}
              aria-label={copy.wordBank.play}
              sx={{ width: 44, height: 44, borderRadius: 1, color: colors.text }}
            >
              <VolumeUpOutlinedIcon />
            </IconButton>
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
              {copy.wordBank.levelDue(
                levelName,
                word.due_date ? formatRelativeDueDate(word.due_date) : '',
              )}
            </Box>
          </Box>
          <MeaningEditor
            value={word.meaning}
            onChange={(meaning) => onMeaningChange(word.id, meaning)}
            addLabel={copy.wordBank.meaning}
          />
          {leeches.length > 0 && (
            <LeechFlag size={13}>
              {copy.wordBank.leechDirections(leeches.map((d) => DIRECTION_LABELS[d]).join(', '))}
            </LeechFlag>
          )}
          {lists.length > 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Overline>{copy.wordBank.lists}</Overline>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <Box component="span" sx={{ fontSize: 14 }}>
                  {listNames.join(', ')}
                </Box>
                <ButtonBase onClick={() => onEditLists(word)} sx={actionSx}>
                  {copy.wordBank.editLists}
                </ButtonBase>
              </Box>
            </Box>
          )}
          <ButtonBase
            onClick={() => onRemove(word)}
            sx={{
              alignSelf: 'flex-start',
              height: 44,
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              color: colors.primaryLight,
            }}
          >
            {removeLabel}
          </ButtonBase>
        </Box>
      )}
    </Box>
  );
};

export default WordRow;
