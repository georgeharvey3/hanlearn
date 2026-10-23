import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { STEPS, StepKey } from './steps';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';

interface StepRailProps {
  at: number;
  /** The steps of this word the learner finished, not skipped. */
  done: Record<StepKey, boolean>;
  onPick: (step: number) => void;
}

/** The three steps of the word under the session bar: done, current, to come. */
const StepRail: React.FC<StepRailProps> = ({ at, done, onPick }) => (
  <Box component="nav" aria-label={copy.newWords.steps} sx={{ mt: 2, display: 'flex', gap: 0.75 }}>
    {STEPS.map((step, i) => {
      const current = i === at;
      return (
        <ButtonBase
          key={step.key}
          onClick={() => onPick(i)}
          aria-current={current ? 'step' : undefined}
          sx={{
            flex: 1,
            height: 36,
            gap: 0.5,
            borderRadius: 1,
            fontFamily: fonts.body,
            fontSize: 14,
            fontWeight: current ? 600 : 400,
            border: `1px solid ${current ? colors.primaryDark : colors.divider}`,
            bgcolor: current ? colors.successSurface : 'transparent',
            color: current
              ? colors.primaryDark
              : done[step.key]
                ? colors.text
                : colors.textSecondary,
          }}
        >
          {done[step.key] && !current && (
            <CheckRoundedIcon sx={{ fontSize: 16, color: colors.primaryDark }} />
          )}
          {step.label}
        </ButtonBase>
      );
    })}
  </Box>
);

export default StepRail;
