import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';

export interface Chip {
  id: string;
  name: string;
  count: number;
}

interface Props {
  chips: Chip[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
}

const chipSx = {
  flex: 'none',
  height: 44,
  boxSizing: 'border-box',
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 14,
} as const;

/**
 * The lists, as a row of chips under the search field. The row scrolls on a
 * thin floating bar: no arrows, no track, a 4 px thumb of ink at 28%.
 */
const ListChips: React.FC<Props> = ({ chips, activeId, onSwitch, onNew }) => (
  <Box
    role="tablist"
    aria-label={copy.wordBank.lists}
    sx={{
      display: 'flex',
      gap: 1,
      overflowX: 'auto',
      // On a phone the row runs under the page gutter to the screen edge.
      mx: { xs: -2, sm: 0 },
      px: { xs: 2, sm: 0 },
      pb: '6px',
      mb: '-6px',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(43,38,34,0.28) transparent',
      '&::-webkit-scrollbar': { height: 4, background: 'transparent' },
      '&::-webkit-scrollbar-track': { background: 'transparent' },
      '&::-webkit-scrollbar-thumb': { background: 'rgba(43,38,34,0.28)', borderRadius: 2 },
      '&::-webkit-scrollbar-button': { display: 'none', width: 0, height: 0 },
    }}
  >
    {chips.map((chip) => {
      const on = chip.id === activeId;
      return (
        <ButtonBase
          key={chip.id}
          role="tab"
          aria-selected={on}
          onClick={() => onSwitch(chip.id)}
          sx={{
            ...chipSx,
            px: '14px',
            gap: 0.75,
            fontWeight: on ? 600 : 400,
            color: on ? colors.primaryDark : colors.text,
            bgcolor: on ? colors.successSurface : colors.card,
            border: `1px solid ${on ? colors.primaryDark : colors.borderStrong}`,
          }}
        >
          {chip.name}{' '}
          <Box component="span" sx={{ fontWeight: 400, color: colors.textSecondary }}>
            {chip.count}
          </Box>
        </ButtonBase>
      );
    })}
    <ButtonBase
      onClick={onNew}
      aria-label={copy.wordBank.newList}
      sx={{
        ...chipSx,
        width: 44,
        border: `1px dashed ${colors.borderStrong}`,
        color: colors.textSecondary,
      }}
    >
      <AddRoundedIcon sx={{ fontSize: 18 }} />
    </ButtonBase>
  </Box>
);

export default ListChips;
