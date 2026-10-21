// PROTOTYPE (#401) variant C, "Workspace": a desktop has no top bar, only a
// sidebar that collapses to an icon rail and leads with a "Study now" button.
// A phone has a top bar that names the page, a drawer, and a floating Study
// button. Loading is a thin bar over the page, and an error is a banner in
// the page, so the frame never blanks.
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import Fab from '@mui/material/Fab';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import LogoutIcon from '@mui/icons-material/Logout';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';

import { colors } from '../../../theme';
import {
  ShellProps,
  shellCopy,
  shellLinks,
  isActive,
  pageTitle,
  useDueCount,
  toastColors,
} from './shellShared';

export const name = 'Workspace';

const WIDE = 248;
const NARROW = 72;
const BAR_H = 56;

interface PanelProps {
  collapsed: boolean;
  due: number;
  onNavigate?: () => void;
  onToggle?: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

const Panel: React.FC<PanelProps> = ({
  collapsed,
  due,
  onNavigate,
  onToggle,
  onOpenShortcuts,
  onLogout,
}) => {
  const { pathname } = useLocation();
  const item = (label: string, icon: React.ReactNode, active: boolean, extra: object) => (
    <Tooltip key={label} title={collapsed ? label : ''} placement="right">
      <ButtonBase
        {...extra}
        sx={{
          width: '100%',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.5,
          px: collapsed ? 0 : 1.5,
          py: 1.1,
          borderRadius: 2,
          fontSize: 15,
          fontWeight: active ? 700 : 500,
          color: colors.text,
          bgcolor: active ? colors.card : 'transparent',
          boxShadow: active ? `0 1px 0 ${colors.divider}` : 'none',
          '&:hover': { bgcolor: active ? colors.card : 'rgba(0,0,0,0.05)' },
        }}
      >
        {icon}
        {!collapsed && label}
      </ButtonBase>
    </Tooltip>
  );

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        gap: 0.5,
        bgcolor: colors.primary,
      }}
    >
      <Box
        sx={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 0 : 1,
        }}
      >
        <Typography
          component={Link}
          to="/"
          onClick={onNavigate}
          sx={{
            fontFamily: "'Spell of Asia', sans-serif",
            fontSize: collapsed ? 22 : 32,
            color: colors.text,
            textDecoration: 'none',
          }}
        >
          {collapsed ? 'HL' : shellCopy.brand}
        </Typography>
      </Box>
      <Button
        component={Link}
        to="/test-words"
        onClick={onNavigate}
        variant="contained"
        sx={{
          my: 1.5,
          minWidth: 0,
          py: 1.25,
          borderRadius: 2,
          bgcolor: colors.primaryDark,
          color: colors.white,
          justifyContent: collapsed ? 'center' : 'space-between',
          '&:hover': { bgcolor: colors.primaryDarkHover },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlayArrowRoundedIcon />
          {!collapsed && shellCopy.studyNow}
        </Box>
        {!collapsed && due > 0 && (
          <Box component="span" sx={{ fontSize: 13, opacity: 0.85 }}>
            {shellCopy.due(due)}
          </Box>
        )}
      </Button>
      {shellLinks
        .filter((l) => l.to !== '/test-words')
        .map((l) =>
          item(l.label, l.icon, isActive(pathname, l.to), {
            component: Link,
            to: l.to,
            onClick: onNavigate,
          }),
        )}
      <Box sx={{ flex: 1 }} />
      {item(shellCopy.shortcuts, <KeyboardIcon />, false, { onClick: onOpenShortcuts })}
      {item(shellCopy.logout, <LogoutIcon />, false, { onClick: onLogout })}
      {onToggle &&
        item(
          collapsed ? shellCopy.expand : shellCopy.collapse,
          collapsed ? <KeyboardDoubleArrowRightIcon /> : <KeyboardDoubleArrowLeftIcon />,
          false,
          { onClick: onToggle },
        )}
    </Box>
  );
};

const ShellVariantC: React.FC<ShellProps> = (props) => {
  const { pathname } = useLocation();
  const due = useDueCount();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const auth = props.isAuthenticated;
  const shell = !props.focused;
  const side = collapsed ? NARROW : WIDE;
  const onTest = pathname.startsWith('/test-words');

  const panelActions = { onOpenShortcuts: props.onOpenShortcuts, onLogout: props.onLogout };

  return (
    <>
      {shell && auth && (
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            display: { xs: 'none', sm: 'block' },
            position: 'fixed',
            inset: '0 auto 0 0',
            width: side,
            transition: 'width 0.2s ease',
            zIndex: 1100,
            borderRight: `1px solid ${colors.divider}`,
          }}
        >
          <Panel
            collapsed={collapsed}
            due={due}
            onToggle={() => setCollapsed((c) => !c)}
            {...panelActions}
          />
        </Box>
      )}

      {shell && (
        <Box
          component="header"
          sx={{
            display: { xs: 'flex', sm: auth ? 'none' : 'flex' },
            position: 'fixed',
            inset: '0 0 auto 0',
            height: BAR_H,
            alignItems: 'center',
            gap: 1,
            px: 1,
            bgcolor: colors.primary,
            zIndex: 1100,
          }}
        >
          {auth ? (
            <>
              <IconButton
                aria-label={shellCopy.menu}
                onClick={() => setDrawerOpen(true)}
                sx={{ color: colors.text }}
              >
                <MenuIcon />
              </IconButton>
              <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 18, textAlign: 'left' }}>
                {pageTitle(pathname)}
              </Typography>
              {due > 0 && (
                <Box
                  sx={{
                    mr: 1,
                    px: 1,
                    py: 0.25,
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    bgcolor: colors.card,
                    color: colors.primaryLight,
                  }}
                >
                  {shellCopy.due(due)}
                </Box>
              )}
            </>
          ) : (
            <>
              <Typography
                component={Link}
                to="/"
                sx={{
                  flex: 1,
                  textAlign: 'left',
                  pl: 1,
                  fontFamily: "'Spell of Asia', sans-serif",
                  fontSize: 32,
                  color: colors.text,
                  textDecoration: 'none',
                }}
              >
                {shellCopy.brand}
              </Typography>
              <Button onClick={props.onLogin} sx={{ color: colors.text }}>
                {shellCopy.login}
              </Button>
              <Button
                onClick={props.onRegister}
                variant="contained"
                sx={{ bgcolor: colors.primaryDark, color: colors.white }}
              >
                {shellCopy.signUp}
              </Button>
            </>
          )}
        </Box>
      )}

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ display: { sm: 'none' }, '& .MuiDrawer-paper': { width: 280, maxWidth: '82%' } }}
      >
        <Panel
          collapsed={false}
          due={due}
          onNavigate={() => setDrawerOpen(false)}
          onOpenShortcuts={() => {
            props.onOpenShortcuts();
            setDrawerOpen(false);
          }}
          onLogout={props.onLogout}
        />
      </Drawer>

      <Box
        id="main-content"
        component="main"
        sx={{
          position: 'relative',
          minHeight: '100%',
          pt: shell ? { xs: `${BAR_H + 16}px`, sm: auth ? 3 : `${BAR_H + 16}px` } : 0,
          pl: shell && auth ? { xs: 2, sm: `${side + 32}px` } : shell ? 2 : 0,
          pr: shell ? { xs: 2, sm: 4 } : 0,
          pb: 10,
          transition: 'padding-left 0.2s ease',
        }}
      >
        {props.previewState === 'loading' && (
          <LinearProgress
            aria-label={shellCopy.loading}
            sx={{
              position: 'fixed',
              top: { xs: shell ? BAR_H : 0, sm: 0 },
              left: { xs: 0, sm: shell && auth ? side : 0 },
              right: 0,
              zIndex: 1200,
              bgcolor: colors.primary,
              '& .MuiLinearProgress-bar': { bgcolor: colors.primaryDark },
            }}
          />
        )}
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          {props.previewState === 'error' && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small">
                  {shellCopy.tryAgain}
                </Button>
              }
              sx={{ mb: 2, textAlign: 'left' }}
            >
              {shellCopy.errorBody}
            </Alert>
          )}
          <Box
            sx={{ opacity: props.previewState === 'loading' ? 0.4 : 1, transition: 'opacity 0.2s' }}
          >
            {props.children}
          </Box>
        </Box>
      </Box>

      {shell && auth && !onTest && (
        <Fab
          variant="extended"
          component={Link}
          to="/test-words"
          sx={{
            display: { xs: 'inline-flex', sm: 'none' },
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            bgcolor: colors.primaryDark,
            color: colors.white,
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { bgcolor: colors.primaryDarkHover },
          }}
        >
          <PlayArrowRoundedIcon sx={{ mr: 0.5 }} />
          {due > 0 ? `${shellCopy.study} · ${due}` : shellCopy.study}
        </Fab>
      )}

      {props.notification && (
        <Box
          role="alert"
          sx={{
            position: 'fixed',
            zIndex: 1400,
            left: { xs: 16, sm: shell && auth ? side + 24 : 24 },
            right: { xs: 16, sm: 'auto' },
            bottom: { xs: shell && auth && !onTest ? 88 : 16, sm: 24 },
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2,
            py: 1.5,
            borderRadius: 2,
            bgcolor: colors.text,
            color: colors.paper,
            borderLeft: `4px solid ${toastColors[props.notification.severity].bg}`,
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
            textAlign: 'left',
          }}
        >
          <Box sx={{ flex: 1 }}>{props.notification.message}</Box>
          <ButtonBase
            onClick={props.onDismissNotification}
            sx={{ color: colors.primary, fontWeight: 700, fontSize: 14 }}
          >
            {shellCopy.dismiss}
          </ButtonBase>
        </Box>
      )}
    </>
  );
};

export default ShellVariantC;
