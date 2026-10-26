import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';

export type PageTab = 'mine' | 'premade';

/**
 * The two tabs at the top of the Add words page: the learner's own words, and
 * the premade lists. A tap on the open Premade tab goes back to the catalogue.
 */
const PageTabs: React.FC<{ tab: PageTab; onTab: (tab: PageTab) => void }> = ({ tab, onTab }) => (
  <Box
    role="tablist"
    aria-label={copy.premadeLists.tabs}
    sx={{ display: 'flex', p: 0.5, borderRadius: 1, bgcolor: colors.skeleton }}
  >
    {(['mine', 'premade'] as const).map((t) => (
      <ButtonBase
        key={t}
        role="tab"
        aria-selected={tab === t}
        onClick={() => onTab(t)}
        sx={{
          flex: 1,
          height: 40,
          borderRadius: 1,
          fontFamily: fonts.body,
          fontSize: 15,
          fontWeight: 600,
          color: tab === t ? colors.text : colors.textSecondary,
          bgcolor: tab === t ? colors.card : 'transparent',
          boxShadow: tab === t ? '0 1px 3px rgba(70,50,30,0.18)' : 'none',
        }}
      >
        {t === 'mine' ? copy.premadeLists.mine : copy.premadeLists.heading}
      </ButtonBase>
    ))}
  </Box>
);

export default PageTabs;
