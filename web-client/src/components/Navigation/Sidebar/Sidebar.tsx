import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import StudyButton, { useDueCount } from '../StudyButton/StudyButton';
import {
  HomeIcon,
  AddIcon,
  StatsIcon,
  SettingsIcon,
  ShortcutsIcon,
  LogoutIcon,
  CollapseIcon,
  ExpandIcon,
} from '../icons';
import { routes, isActive } from '../navLinks';
import * as actions from '../../../store/actions/index';
import { AppDispatch } from '../../../types/actions';
import { colors, fonts } from '../../../theme';
import { copy } from '../../../copy';
import { LogoMark, Wordmark } from '../../Logo/Logo';

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 } as const;

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenShortcuts: () => void;
}

const links = [
  { to: routes.home, label: copy.shell.home, icon: <HomeIcon size={22} /> },
  { to: routes.add, label: copy.shell.addWords, icon: <AddIcon size={22} /> },
  { to: routes.settings, label: copy.shell.settings, icon: <SettingsIcon size={22} /> },
];

/**
 * The desktop's sidebar. It starts with the Study button and collapses to a
 * rail of icons; the rail names each icon to a screen reader. Stats sits with
 * Shortcuts at the foot, as it sits in the phone's More sheet.
 */
const Sidebar: React.FC<Props> = ({ collapsed, onToggleCollapsed, onOpenShortcuts }) => {
  const { pathname } = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const due = useDueCount();

  // An item is a full row when open, and a 48 px icon button in the rail.
  const itemSx = (active = false) => ({
    height: 44,
    flexShrink: 0,
    borderRadius: 1,
    gap: 1.5,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    textDecoration: 'none',
    ...(collapsed
      ? { width: 48, justifyContent: 'center' }
      : { width: '100%', px: 1.5, justifyContent: 'flex-start' }),
    ...(active
      ? { bgcolor: colors.card, fontWeight: 700, boxShadow: `0 1px 0 ${colors.divider}` }
      : { '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }),
  });

  const label = (text: string) => (collapsed ? { 'aria-label': text } : {});

  return (
    <Box
      component="nav"
      aria-label={copy.shell.mainNav}
      sx={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 1100,
        width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
        boxSizing: 'border-box',
        p: collapsed ? '12px 0' : 1.5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'stretch',
        gap: 0.5,
        overflowY: 'auto',
        bgcolor: colors.primary,
        borderRight: `1px solid ${colors.divider}`,
        color: colors.text,
      }}
    >
      <Box sx={{ height: 48, px: collapsed ? 0 : 1, display: 'flex', alignItems: 'center' }}>
        {collapsed ? (
          <Box
            component={Link}
            to={routes.home}
            aria-label={copy.shell.homeLink}
            sx={{ display: 'flex', borderRadius: '9px' }}
          >
            <LogoMark size={40} />
          </Box>
        ) : (
          <Box
            component={Link}
            to={routes.home}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              fontSize: 27,
              textDecoration: 'none',
            }}
          >
            <LogoMark size={36} />
            <Wordmark text={copy.shell.brand} />
          </Box>
        )}
      </Box>

      <ButtonBase
        component={Link}
        to={routes.study}
        aria-label={due > 0 ? copy.shell.studyDue(due) : copy.shell.study}
        sx={{
          my: 1.5,
          flexShrink: 0,
          borderRadius: 1,
          textDecoration: 'none',
          ...(collapsed
            ? { width: 56, height: 56 }
            : { p: 1, gap: 1.75, justifyContent: 'flex-start' }),
        }}
      >
        <StudyButton due={due} size={collapsed ? 48 : 52} />
        {!collapsed && (
          <Box
            component="span"
            sx={{
              fontFamily: fonts.body,
              fontSize: 17,
              fontWeight: 700,
              color: colors.primaryDark,
            }}
          >
            {copy.shell.study}
          </Box>
        )}
      </ButtonBase>

      {links.map((link) => (
        <ButtonBase
          key={link.to}
          component={Link}
          to={link.to}
          aria-current={isActive(pathname, link.to) ? 'page' : undefined}
          {...label(link.label)}
          sx={itemSx(isActive(pathname, link.to))}
        >
          {link.icon}
          {!collapsed && link.label}
        </ButtonBase>
      ))}

      <Box sx={{ flex: 1 }} />

      <ButtonBase
        component={Link}
        to={routes.stats}
        aria-current={isActive(pathname, routes.stats) ? 'page' : undefined}
        {...label(copy.shell.stats)}
        sx={itemSx(isActive(pathname, routes.stats))}
      >
        <StatsIcon size={22} />
        {!collapsed && copy.shell.stats}
      </ButtonBase>

      <ButtonBase onClick={onOpenShortcuts} {...label(copy.shell.shortcuts)} sx={itemSx()}>
        <ShortcutsIcon size={22} />
        {!collapsed && copy.shell.shortcuts}
      </ButtonBase>
      <ButtonBase
        onClick={() => dispatch(actions.logout())}
        {...label(copy.shell.logout)}
        sx={itemSx()}
      >
        <LogoutIcon size={22} />
        {!collapsed && copy.shell.logout}
      </ButtonBase>
      <ButtonBase
        onClick={onToggleCollapsed}
        {...label(copy.shell.expand)}
        sx={{ ...itemSx(), color: colors.textSecondary }}
      >
        {collapsed ? <ExpandIcon size={22} /> : <CollapseIcon size={22} />}
        {!collapsed && copy.shell.collapse}
      </ButtonBase>
    </Box>
  );
};

export default Sidebar;
