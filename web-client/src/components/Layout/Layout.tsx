import React, { ReactNode, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import Toolbar, { TOP_BAR_HEIGHT } from '../Navigation/Toolbar/Toolbar';
import TabBar, { TAB_BAR_HEIGHT } from '../Navigation/TabBar/TabBar';
import Sidebar, { SIDEBAR_WIDTH } from '../Navigation/Sidebar/Sidebar';
import NotificationSnackbar from '../NotificationSnackbar/NotificationSnackbar';
import SkipLink from './SkipLink';
import { FocusModeProvider } from './focusMode';
import KeyboardShortcutsDialog from '../KeyboardShortcutsDialog/KeyboardShortcutsDialog';
import { useKeyboardShortcutsDialog } from '../KeyboardShortcutsDialog/useKeyboardShortcutsDialog';
import { RootState } from '../../types/store';

const COLLAPSED_KEY = 'hanlearn.sidebarCollapsed';

// Storage can throw in a private window; the sidebar then starts open.
const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // The choice then lasts only for this visit.
  }
};

interface Props {
  children?: ReactNode;
}

/**
 * The frame round every page. A phone gets a slim top bar and a bottom tab
 * bar; a desktop gets a sidebar that collapses to a rail. A visitor gets only
 * the top bar, with Log in and Sign up.
 */
const Layout: React.FC<Props> = ({ children }) => {
  const isAuth = useSelector((state: RootState) => state.auth.userId !== null);

  const [focusRequested, setFocused] = useState(false);
  // Focus mode is for a phone, where the navigation costs the study screen
  // room it needs. On a wider screen the sidebar sits beside the session, so
  // the navigation stays.
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const focused = focusRequested && phone;

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleCollapsed = useCallback(() => {
    setCollapsed((was) => {
      writeCollapsed(!was);
      return !was;
    });
  }, []);

  const {
    open: shortcutsOpen,
    handleOpen: openShortcuts,
    handleClose: closeShortcuts,
  } = useKeyboardShortcutsDialog();

  const showTopBar = !focused && (phone || !isAuth);
  const showTabBar = !focused && phone && isAuth;
  const showSidebar = !phone && isAuth;
  const sidebarWidth = showSidebar
    ? collapsed
      ? SIDEBAR_WIDTH.collapsed
      : SIDEBAR_WIDTH.expanded
    : 0;
  const topBarHeight = showTopBar ? (phone ? TOP_BAR_HEIGHT.phone : TOP_BAR_HEIGHT.desktop) : 0;
  const gutter = phone ? 16 : 32;

  // A toast sits at the bottom centre of the page: above the tab bar on a
  // phone, above the grade buttons in a session, and right of the sidebar on
  // a desktop.
  const toastBottom = showTabBar
    ? `calc(${TAB_BAR_HEIGHT + 40}px + env(safe-area-inset-bottom))`
    : focused
      ? '140px'
      : '24px';
  const toastCentre = `calc(${sidebarWidth}px + (100% - ${sidebarWidth}px) / 2)`;

  return (
    <FocusModeProvider value={setFocused}>
      <SkipLink />
      {showTopBar && <Toolbar isAuth={isAuth} phone={phone} />}
      {showTabBar && <TabBar onOpenShortcuts={openShortcuts} />}
      {showSidebar && (
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenShortcuts={openShortcuts}
        />
      )}
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
      <Box
        id="main-content"
        component="main"
        sx={{
          boxSizing: 'border-box',
          height: '100%',
          ml: `${sidebarWidth}px`,
          px: `${gutter}px`,
          pt: focused ? 0 : `calc(${topBarHeight + gutter}px + env(safe-area-inset-top))`,
          pb: showTabBar
            ? `calc(${TAB_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom))`
            : focused
              ? 0
              : `${gutter}px`,
        }}
      >
        <Box sx={{ maxWidth: showSidebar ? 1100 : 1440, mx: 'auto', height: '100%' }}>
          {children}
        </Box>
      </Box>
      <NotificationSnackbar bottom={toastBottom} centre={toastCentre} />
    </FocusModeProvider>
  );
};

export default Layout;
