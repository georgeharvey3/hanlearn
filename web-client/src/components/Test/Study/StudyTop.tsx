import React from 'react';
import { Box, IconButton, LinearProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import { copy } from '../../../copy';
import { colors } from '../../../theme';

interface StudyTopProps {
  /** The stage of the session: Test, Listen & translate, Write in Chinese. */
  stage: string;
  /** How many items are done, which fills the bar. */
  done: number;
  total: number;
  /** The item on screen, when the count shows it rather than `done`. */
  position?: number;
  onEnd: () => void;
  /** Opens the test settings. A stage without settings leaves it out. */
  onSettings?: () => void;
  /** Leaves out the count, while the session's size is not known yet. */
  hideCount?: boolean;
}

/**
 * The bar at the top of every study screen. A session hides the app's own
 * navigation, so the close button here is the way out.
 */
const StudyTop: React.FC<StudyTopProps> = ({
  stage,
  done,
  total,
  position,
  onEnd,
  onSettings,
  hideCount,
}) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const iconSx = { width: 44, height: 44, color: colors.textSecondary };

  return (
    <Box
      sx={{
        height: 56,
        boxSizing: 'border-box',
        py: 0.75,
        mx: -1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        color: colors.textSecondary,
      }}
    >
      <IconButton aria-label={copy.study.endSession} onClick={onEnd} sx={iconSx}>
        <CloseRoundedIcon sx={{ fontSize: 22 }} />
      </IconButton>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: 12,
          }}
        >
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              color: colors.text,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {stage}
          </Box>
          {!hideCount && (
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {copy.study.progressCount(position ?? done, total)}
            </Box>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={percent}
          aria-label={copy.study.progressLabel(percent)}
          sx={{
            height: 4,
            borderRadius: 2,
            bgcolor: colors.divider,
            '& .MuiLinearProgress-bar': { bgcolor: colors.primaryDark, borderRadius: 2 },
          }}
        />
      </Box>
      {onSettings ? (
        <IconButton aria-label={copy.study.settings} onClick={onSettings} sx={iconSx}>
          <TuneRoundedIcon sx={{ fontSize: 22 }} />
        </IconButton>
      ) : (
        <Box sx={{ width: 44, flex: 'none' }} />
      )}
    </Box>
  );
};

export default React.memo(StudyTop);
