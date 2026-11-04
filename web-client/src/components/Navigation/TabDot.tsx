import React from 'react';
import Box from '@mui/material/Box';

import { colors } from '../../theme';

/**
 * The dot on a sentence tab that holds a word never practised there. It shows
 * no count, so sentence practice does not read as a debt (#489). The link
 * names it to a screen reader. The seal red of the Study badge.
 */
const TabDot: React.FC<{ sx?: object }> = ({ sx }) => (
  <Box
    component="span"
    aria-hidden="true"
    data-testid="tab-dot"
    sx={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      bgcolor: colors.primaryLight,
      flexShrink: 0,
      ...sx,
    }}
  />
);

export default TabDot;
