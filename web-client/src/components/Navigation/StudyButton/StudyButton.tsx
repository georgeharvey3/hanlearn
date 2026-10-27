import React from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';

import { StudyIcon } from '../icons';
import { colors } from '../../../theme';
import { RootState } from '../../../types/store';
import { ALL_LISTS_ID } from '../../../utils/activeList';

/**
 * Words due across all lists, as the list stats last counted them, each word
 * one time however many lists hold it. The shell
 * does not load them itself: the list stats read every word, and Home, Add,
 * Study and Stats load them already.
 */
export const useDueCount = (): number =>
  useSelector((state: RootState) => state.addWords.listStats[ALL_LISTS_ID]?.due ?? 0);

interface Props {
  due: number;
  /** The diameter of the green disc. */
  size: number;
}

/**
 * The round green Study button with the due count in a red badge. The tab bar
 * raises it in the middle of the tabs; the sidebar puts it at the top.
 */
const StudyButton: React.FC<Props> = ({ due, size }) => (
  <Box
    component="span"
    sx={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: '50%',
      bgcolor: colors.primaryDark,
      color: colors.white,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 16px -6px rgba(26,92,64,0.6)',
    }}
  >
    <StudyIcon size={Math.round(size * 0.46)} />
    {due > 0 && (
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          position: 'absolute',
          top: -4,
          right: -6,
          minWidth: 22,
          height: 22,
          boxSizing: 'border-box',
          px: '6px',
          borderRadius: '4px',
          // The colour of the bars, so the badge reads as cut out of them.
          border: `2px solid ${colors.primary}`,
          bgcolor: colors.primaryLight,
          color: colors.white,
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {due}
      </Box>
    )}
  </Box>
);

export default StudyButton;
