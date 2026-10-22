import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import StudyButton, { useDueCount } from '../StudyButton/StudyButton';
import MoreSheet from './MoreSheet';
import { HomeIcon, AddIcon, StatsIcon, MoreIcon } from '../icons';
import { routes, isActive } from '../navLinks';
import { colors, fonts } from '../../../theme';
import { copy } from '../../../copy';

export const TAB_BAR_HEIGHT = 64;

interface Props {
  onOpenShortcuts: () => void;
}

const tabSx = (active: boolean) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  fontFamily: fonts.body,
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  color: active ? colors.primaryDark : colors.textSecondary,
  textDecoration: 'none',
});

/**
 * The phone's bottom tab bar: Home, Add, a raised Study button, Stats and
 * More. More opens a sheet with the rest.
 */
const TabBar: React.FC<Props> = ({ onOpenShortcuts }) => {
  const { pathname } = useLocation();
  const due = useDueCount();
  const [moreOpen, setMoreOpen] = useState(false);

  const tab = (to: string, label: string, icon: React.ReactNode) => (
    <ButtonBase component={Link} to={to} sx={tabSx(isActive(pathname, to))}>
      {icon}
      <span>{label}</span>
    </ButtonBase>
  );

  return (
    <>
      <Box
        component="nav"
        aria-label={copy.shell.mainNav}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          height: TAB_BAR_HEIGHT,
          pb: 'env(safe-area-inset-bottom)',
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: colors.primary,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        {tab(routes.home, copy.shell.home, <HomeIcon />)}
        {tab(routes.add, copy.shell.add, <AddIcon />)}
        <ButtonBase
          component={Link}
          to={routes.study}
          aria-label={due > 0 ? copy.shell.studyDue(due) : copy.shell.study}
          sx={{ ...tabSx(true), justifyContent: 'flex-start', mt: '-24px' }}
        >
          <Box
            component="span"
            sx={{ display: 'flex', borderRadius: '50%', boxShadow: `0 0 0 4px ${colors.primary}` }}
          >
            <StudyButton due={due} size={56} />
          </Box>
          <span>{copy.shell.study}</span>
        </ButtonBase>
        {tab(routes.stats, copy.shell.stats, <StatsIcon />)}
        <ButtonBase onClick={() => setMoreOpen(true)} sx={tabSx(moreOpen)}>
          <MoreIcon />
          <span>{copy.shell.more}</span>
        </ButtonBase>
      </Box>
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenShortcuts={onOpenShortcuts}
      />
    </>
  );
};

export default TabBar;
