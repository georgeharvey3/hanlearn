import React from 'react';
import { Box } from '@mui/material';

import { hanziSx } from '../Test/Study/parts';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { Word } from '../../types/models';
import { EntryState } from './SearchResults';

/** A word of a premade list, and whether the learner has it. */
export interface PremadeWord {
  entry: Word;
  state: EntryState;
}

// The rows are plain elements styled from the list: HSK 7–9 has 5,592 words,
// and a styled component for each row is slow on a phone.
const listSx = {
  m: 0,
  p: 0,
  listStyle: 'none',
  fontFamily: fonts.body,
  color: colors.text,
  textAlign: 'left',
  '& li': {
    minHeight: 64,
    py: 1.5,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    borderBottom: `1px solid ${colors.divider}`,
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 64px',
  },
  '& .hanzi': hanziSx(28, { minWidth: 56 }),
  '& .text': { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  '& .pinyin': { fontSize: 15 },
  '& .meaning': {
    fontSize: 13,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '& .added': { flex: 'none', fontSize: 13, fontWeight: 600, color: colors.primaryDark },
  '& .block': { height: 10, borderRadius: '2px', bgcolor: colors.skeleton },
} as const;

/**
 * The words of a premade list. A word the learner has and that is due soon
 * shows its characters only, as in the search results: its pinyin and
 * meaning would prime the answer of the next session.
 */
const PremadeWords: React.FC<{ words: PremadeWord[]; charSet: 'simp' | 'trad' }> = ({
  words,
  charSet,
}) => (
  <Box component="ul" aria-label={copy.premadeLists.words} sx={listSx}>
    {words.map(({ entry, state }) => (
      <li key={entry.id}>
        <span className="hanzi" lang="zh">
          {entry[charSet]}
        </span>
        {state === 'covered' ? (
          <span className="text" aria-hidden>
            <span className="block" style={{ width: 72 }} />
            <span className="block" style={{ width: 140 }} />
          </span>
        ) : (
          <span className="text">
            <span className="pinyin" lang="zh-Latn">
              {entry.pinyin}
            </span>
            <span className="meaning">{entry.meaning}</span>
          </span>
        )}
        {state !== 'new' && <span className="added">{copy.wordBank.added}</span>}
      </li>
    ))}
  </Box>
);

export default PremadeWords;
