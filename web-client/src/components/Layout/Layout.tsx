import React, { ReactNode, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import Toolbar from '../Navigation/Toolbar/Toolbar';
import SideDrawer from '../Navigation/SideDrawer/SideDrawer';
import Sidebar, { SIDEBAR_WIDTH } from '../Navigation/Sidebar/Sidebar';
import SkipLink from './SkipLink';
import { FocusModeProvider } from './focusMode';
import KeyboardShortcutsDialog from '../KeyboardShortcutsDialog/KeyboardShortcutsDialog';
import { useKeyboardShortcutsDialog } from '../KeyboardShortcutsDialog/useKeyboardShortcutsDialog';
import { RootState } from '../../types/store';
import * as actions from '../../store/actions/index';
import ErrorBoundary from '../ErrorBoundary/ErrorBoundary';
// PROTOTYPE (#401): three app-shell variants on every route, chosen by
// `?variant=A|B|C`; no param is the current shell. `?state=loading|error`
// previews the feedback states. Throwaway: this lives on
// `prototype/app-shell-401` only.
import PrototypeSwitcher, {
  usePrototypeParam,
  useStickyPrototypeParam,
} from '../UI/PrototypeSwitcher/PrototypeSwitcher';
import ShellVariantA, { name as nameA } from './prototype/ShellVariantA';
import ShellVariantB, { name as nameB } from './prototype/ShellVariantB';
import ShellVariantC, { name as nameC } from './prototype/ShellVariantC';

interface LayoutState {
  showSideDrawer: boolean;
}

const mapStateToProps = (state: RootState) => {
  return {
    isAuthenticated: state.auth.userId !== null,
    notification: state.notifications.queue[0] ?? null,
  };
};

const mapDispatchToProps = {
  onDismiss: actions.dismissNotification,
  onShow: actions.showNotification,
  onLogout: actions.logout,
  onOpenAuthModal: actions.openAuthModal,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

const shellVariants = { A: ShellVariantA, B: ShellVariantB, C: ShellVariantC };

const prototypeToasts: [string, 'success' | 'error' | 'info' | 'warning'][] = [
  ['Word added', 'success'],
  ["Couldn't save the word", 'error'],
  ['A new version is ready', 'info'],
  ['You are offline', 'warning'],
];
let toastIndex = 0;

const Thrower: React.FC = () => {
  throw new Error('PROTOTYPE: preview of the error state');
};
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  children?: ReactNode;
}

type Props = PropsFromRedux & OwnProps;

const Layout: React.FC<Props> = ({
  isAuthenticated,
  notification,
  onDismiss,
  onShow,
  onLogout,
  onOpenAuthModal,
  children,
}) => {
  const [state, setState] = useState<LayoutState>({
    showSideDrawer: false,
  });
  const [focusRequested, setFocused] = useState(false);
  // Focus mode is for a phone, where the navigation costs the study screen
  // room it needs. On a wider screen the sidebar sits beside the session, so
  // the navigation stays.
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const focused = focusRequested && phone;
  const {
    open: shortcutsOpen,
    handleOpen: openShortcuts,
    handleClose: closeShortcuts,
  } = useKeyboardShortcutsDialog();

  const variantParam = useStickyPrototypeParam('variant');
  const stateParam = usePrototypeParam('state');
  const variant = import.meta.env.PROD ? '' : variantParam;
  const previewState = import.meta.env.PROD ? '' : stateParam;
  const Shell = shellVariants[variant as keyof typeof shellVariants];

  // The variants draw their own toast, so they dismiss it here.
  useEffect(() => {
    if (!Shell || !notification) return;
    const id = setTimeout(() => onDismiss(notification.id), notification.duration ?? 4000);
    return () => clearTimeout(id);
  }, [Shell, notification, onDismiss]);

  const switcher = (
    <PrototypeSwitcher
      variants={[
        { key: '', name: 'Current' },
        { key: 'A', name: nameA },
        { key: 'B', name: nameB },
        { key: 'C', name: nameC },
      ]}
      states={[
        { key: '', name: 'Normal' },
        { key: 'loading', name: 'Loading' },
        { key: 'error', name: 'Error' },
      ]}
      actions={[
        {
          name: 'Toast',
          run: () => onShow(...prototypeToasts[toastIndex++ % prototypeToasts.length]),
        },
      ]}
    />
  );

  if (Shell) {
    return (
      <FocusModeProvider value={setFocused}>
        <SkipLink />
        <Shell
          isAuthenticated={isAuthenticated}
          focused={focused}
          previewState={previewState}
          notification={notification}
          onDismissNotification={() => notification && onDismiss(notification.id)}
          onOpenShortcuts={openShortcuts}
          onLogout={onLogout}
          onLogin={() => onOpenAuthModal('login')}
          onRegister={() => onOpenAuthModal('register')}
        >
          {children}
        </Shell>
        <KeyboardShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
        {switcher}
      </FocusModeProvider>
    );
  }

  const currentBody =
    previewState === 'loading' ? (
      <Box role="status" sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    ) : previewState === 'error' ? (
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    ) : (
      children
    );

  const sideDrawerClosedHandler = (): void => {
    setState({ showSideDrawer: false });
  };

  const sideDrawerToggleHandler = (): void => {
    setState((prevState) => ({ showSideDrawer: !prevState.showSideDrawer }));
  };

  return (
    <FocusModeProvider value={setFocused}>
      <SkipLink />
      {!focused && (
        <>
          <Toolbar drawerToggleClicked={sideDrawerToggleHandler} isAuth={isAuthenticated} />
          <SideDrawer
            open={state.showSideDrawer}
            closed={sideDrawerClosedHandler}
            isAuth={isAuthenticated}
            onOpenShortcuts={openShortcuts}
          />
          {isAuthenticated && <Sidebar onOpenShortcuts={openShortcuts} />}
        </>
      )}
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
      <Container
        id="main-content"
        component="main"
        maxWidth={false}
        sx={{
          mt: focused ? 0 : '56px',
          pt: focused ? 0 : 3,
          height: '100%',
          ...(focused
            ? { maxWidth: '100%' }
            : isAuthenticated
              ? {
                  ml: { xs: 0, sm: `${SIDEBAR_WIDTH}px` },
                  maxWidth: { xs: '100%', sm: 1440 - SIDEBAR_WIDTH },
                }
              : { maxWidth: 1440 }),
        }}
      >
        {currentBody}
      </Container>
      {switcher}
    </FocusModeProvider>
  );
};

export default connector(Layout);
