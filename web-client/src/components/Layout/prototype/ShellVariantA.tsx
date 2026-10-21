// PROTOTYPE (#401) variant A, "Tab bar": a native-app shell. A phone gets a
// bottom tab bar with a raised Study button and a "More" sheet; a desktop gets
// a narrow icon rail. No hamburger anywhere. Toasts sit above the tabs.
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SchoolIcon from '@mui/icons-material/School';
import CloseIcon from '@mui/icons-material/Close';

import { colors, fonts, shadows } from '../../../theme';
import {
  ShellProps,
  shellCopy,
  shellLinks,
  isActive,
  useDueCount,
  toastColors,
} from './shellShared';

export const name = 'Tab bar';

const TAB_H = 64;
const RAIL_W = 88;

const StudyButton: React.FC<{ due: number; size: number }> = ({ due, size }) => (
  <Badge
    badgeContent={due || null}
    color="error"
    overlap="circular"
    sx={{ '& .MuiBadge-badge': { bgcolor: colors.primaryLight, fontWeight: 700 } }}
  >
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: colors.primaryDark,
        color: colors.white,
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 6px 16px -6px rgba(26,92,64,0.6)',
      }}
    >
      <SchoolIcon />
    </Box>
  </Badge>
);

const Loading: React.FC = () => (
  <Box role="status" aria-label={shellCopy.loading} sx={{ maxWidth: 560, mx: 'auto', p: 2 }}>
    <Skeleton variant="rounded" height={140} sx={{ mb: 2, borderRadius: 3 }} />
    <Skeleton variant="text" width="60%" />
    <Skeleton variant="text" width="80%" />
    <Skeleton variant="rounded" height={64} sx={{ mt: 2, borderRadius: 3 }} />
    <Skeleton variant="rounded" height={64} sx={{ mt: 1, borderRadius: 3 }} />
  </Box>
);

const ErrorState: React.FC = () => (
  <Box sx={{ maxWidth: 420, mx: 'auto', p: 2, pt: 6 }}>
    <Box
      role="alert"
      sx={{
        bgcolor: colors.card,
        borderRadius: 3,
        borderLeft: `4px solid ${colors.primaryLight}`,
        boxShadow: shadows.card,
        p: 3,
        textAlign: 'left',
      }}
    >
      <Typography variant="h6">{shellCopy.errorTitle}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {shellCopy.errorBody}
      </Typography>
      <Button
        variant="contained"
        sx={{ bgcolor: colors.primaryDark, color: colors.white, borderRadius: 999 }}
      >
        {shellCopy.tryAgain}
      </Button>
    </Box>
  </Box>
);

const ShellVariantA: React.FC<ShellProps> = (props) => {
  const { pathname } = useLocation();
  const due = useDueCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const auth = props.isAuthenticated;
  const shell = !props.focused;

  const body =
    props.previewState === 'loading' ? (
      <Loading />
    ) : props.previewState === 'error' ? (
      <ErrorState />
    ) : (
      props.children
    );

  // Study sits in the middle of the five tabs.
  const tabs = ['/', '/add-words', '/test-words', '/stats'].map(
    (to) => shellLinks.find((l) => l.to === to)!,
  );

  const tab = (l: (typeof shellLinks)[number]) => {
    const active = isActive(pathname, l.to);
    if (l.to === '/test-words') {
      return (
        <ButtonBase
          key={l.to}
          component={Link}
          to={l.to}
          aria-label={l.label}
          sx={{ flex: 1, mt: -3, display: 'flex', flexDirection: 'column', gap: 0.25 }}
        >
          <StudyButton due={due} size={56} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: colors.primaryDark }}>
            {l.short}
          </Typography>
        </ButtonBase>
      );
    }
    return (
      <ButtonBase
        key={l.to}
        component={Link}
        to={l.to}
        sx={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          color: active ? colors.primaryDark : colors.textSecondary,
        }}
      >
        {l.icon}
        <Typography sx={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{l.short}</Typography>
      </ButtonBase>
    );
  };

  const toast = props.notification && (
    <Box
      role="alert"
      onClick={props.onDismissNotification}
      sx={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: { xs: shell && auth ? TAB_H + 16 : 16, sm: 24 },
        zIndex: 1400,
        px: 2.5,
        py: 1.25,
        borderRadius: 999,
        bgcolor: toastColors[props.notification.severity].bg,
        color: toastColors[props.notification.severity].fg,
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.4)',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {props.notification.message}
    </Box>
  );

  return (
    <>
      {shell && (
        // Phone top bar: brand only. Desktop: nothing on top; the rail holds it.
        <Box
          component="header"
          sx={{
            display: { xs: 'flex', sm: auth ? 'none' : 'flex' },
            position: 'fixed',
            inset: '0 0 auto 0',
            height: 48,
            alignItems: 'center',
            justifyContent: auth ? 'center' : 'space-between',
            px: 2,
            bgcolor: colors.paper,
            borderBottom: `1px solid ${colors.divider}`,
            zIndex: 1100,
          }}
        >
          <Typography
            component={Link}
            to="/"
            sx={{
              fontFamily: "'Spell of Asia', sans-serif",
              fontSize: 30,
              color: colors.text,
              textDecoration: 'none',
            }}
          >
            {shellCopy.brand}
          </Typography>
          {!auth && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={props.onLogin} sx={{ color: colors.text }}>
                {shellCopy.login}
              </Button>
              <Button
                onClick={props.onRegister}
                variant="contained"
                sx={{ bgcolor: colors.primaryDark, color: colors.white, borderRadius: 999 }}
              >
                {shellCopy.signUp}
              </Button>
            </Box>
          )}
        </Box>
      )}

      {shell && auth && (
        // Desktop rail.
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            display: { xs: 'none', sm: 'flex' },
            position: 'fixed',
            inset: '0 auto 0 0',
            width: RAIL_W,
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 1,
            bgcolor: colors.primary,
            zIndex: 1100,
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              width: 48,
              height: 48,
              mb: 2,
              borderRadius: 2,
              bgcolor: colors.primaryLight,
              color: colors.white,
              display: 'grid',
              placeItems: 'center',
              fontFamily: fonts.hanzi,
              fontSize: 28,
              textDecoration: 'none',
            }}
          >
            汉
          </Box>
          <ButtonBase component={Link} to="/test-words" sx={{ flexDirection: 'column', mb: 2 }}>
            <StudyButton due={due} size={52} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, mt: 0.5, color: colors.primaryDark }}>
              {shellCopy.study}
            </Typography>
          </ButtonBase>
          {shellLinks
            .filter((l) => l.to !== '/test-words')
            .map((l) => {
              const active = isActive(pathname, l.to);
              return (
                <ButtonBase
                  key={l.to}
                  component={Link}
                  to={l.to}
                  sx={{
                    width: 72,
                    py: 1,
                    borderRadius: 3,
                    flexDirection: 'column',
                    gap: 0.25,
                    color: active ? colors.primaryDark : colors.text,
                    bgcolor: active ? 'rgba(26,92,64,0.12)' : 'transparent',
                  }}
                >
                  {l.icon}
                  <Typography sx={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>
                    {l.short}
                  </Typography>
                </ButtonBase>
              );
            })}
          <Box sx={{ flex: 1 }} />
          <ButtonBase
            onClick={props.onOpenShortcuts}
            sx={{ width: 72, py: 1, borderRadius: 3, flexDirection: 'column', color: colors.text }}
          >
            <KeyboardIcon />
            <Typography sx={{ fontSize: 12 }}>{shellCopy.shortcuts}</Typography>
          </ButtonBase>
          <ButtonBase
            onClick={props.onLogout}
            sx={{ width: 72, py: 1, borderRadius: 3, flexDirection: 'column', color: colors.text }}
          >
            <LogoutIcon />
            <Typography sx={{ fontSize: 12 }}>{shellCopy.logout}</Typography>
          </ButtonBase>
        </Box>
      )}

      {shell && auth && (
        // Phone tab bar.
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{
            display: { xs: 'flex', sm: 'none' },
            position: 'fixed',
            inset: 'auto 0 0 0',
            height: TAB_H,
            pb: 'env(safe-area-inset-bottom)',
            alignItems: 'stretch',
            bgcolor: colors.card,
            borderTop: `1px solid ${colors.divider}`,
            zIndex: 1100,
          }}
        >
          {tabs.map(tab)}
          <ButtonBase
            onClick={() => setMoreOpen(true)}
            sx={{ flex: 1, flexDirection: 'column', gap: 0.25, color: colors.textSecondary }}
          >
            <MoreHorizIcon />
            <Typography sx={{ fontSize: 11, fontWeight: 500 }}>{shellCopy.more}</Typography>
          </ButtonBase>
        </Box>
      )}

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px 16px 0 0',
            bgcolor: colors.paper,
            pb: 'env(safe-area-inset-bottom)',
          },
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: colors.borderStrong,
            mx: 'auto',
            my: 1.5,
          }}
        />
        {[
          { label: shellCopy.settings, icon: <SettingsOutlinedIcon />, to: '/settings' },
          { label: shellCopy.shortcuts, icon: <KeyboardIcon />, run: props.onOpenShortcuts },
          { label: shellCopy.logout, icon: <LogoutIcon />, run: props.onLogout },
        ].map((item) => (
          <ButtonBase
            key={item.label}
            {...(item.to ? { component: Link, to: item.to } : {})}
            onClick={() => {
              item.run?.();
              setMoreOpen(false);
            }}
            sx={{
              width: '100%',
              justifyContent: 'flex-start',
              gap: 2,
              px: 3,
              py: 2,
              fontSize: 17,
              color: colors.text,
            }}
          >
            {item.icon}
            {item.label}
          </ButtonBase>
        ))}
        <ButtonBase
          onClick={() => setMoreOpen(false)}
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            gap: 2,
            px: 3,
            py: 2,
            color: colors.textSecondary,
          }}
        >
          <CloseIcon />
          {shellCopy.closeMenu}
        </ButtonBase>
      </Drawer>

      <Box
        id="main-content"
        component="main"
        sx={{
          minHeight: '100%',
          pt: shell ? { xs: '64px', sm: auth ? 3 : '64px' } : 0,
          pb: shell && auth ? { xs: `${TAB_H + 24}px`, sm: 3 } : 0,
          pl: shell && auth ? { xs: 2, sm: `${RAIL_W + 24}px` } : shell ? 2 : 0,
          pr: shell ? { xs: 2, sm: 3 } : 0,
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>{body}</Box>
      </Box>
      {toast}
    </>
  );
};

export default ShellVariantA;
