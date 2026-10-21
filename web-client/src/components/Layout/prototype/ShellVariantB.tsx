// PROTOTYPE (#401) variant B, "Book page": no sidebar at all. A paper top
// bar with text tabs on a desktop, and one centred reading column under it. A
// phone opens a full-screen menu of large hanzi. A toast is a strip under the
// bar, and the loading and error states are single large characters.
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import { keyframes } from '@mui/system';

import { colors, fonts } from '../../../theme';
import {
  ShellProps,
  shellCopy,
  shellLinks,
  isActive,
  useDueCount,
  toastColors,
} from './shellShared';

export const name = 'Book page';

const BAR_H = 64;
const COLUMN = 760;

const breathe = keyframes`
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
`;

const Loading: React.FC = () => (
  <Box role="status" aria-label={shellCopy.loading} sx={{ py: 12, textAlign: 'center' }}>
    <Box
      sx={{
        fontFamily: fonts.hanzi,
        fontSize: 96,
        color: colors.text,
        animation: `${breathe} 1.6s ease-in-out infinite`,
      }}
    >
      学
    </Box>
  </Box>
);

const ErrorState: React.FC = () => (
  <Box role="alert" sx={{ py: 10, textAlign: 'center' }}>
    <Box
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 96,
        height: 96,
        border: `3px solid ${colors.primaryLight}`,
        borderRadius: 1,
        color: colors.primaryLight,
        fontFamily: fonts.hanzi,
        fontSize: 64,
        transform: 'rotate(-4deg)',
        mb: 3,
      }}
    >
      错
    </Box>
    <Typography variant="h5" sx={{ mb: 1 }}>
      {shellCopy.errorTitle}
    </Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>
      {shellCopy.errorBody}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
      <Button variant="contained" sx={{ bgcolor: colors.primaryDark, color: colors.white }}>
        {shellCopy.tryAgain}
      </Button>
      <Button component={Link} to="/" sx={{ color: colors.text }}>
        {shellCopy.goHome}
      </Button>
    </Box>
  </Box>
);

const ShellVariantB: React.FC<ShellProps> = (props) => {
  const { pathname } = useLocation();
  const due = useDueCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountEl, setAccountEl] = useState<HTMLElement | null>(null);
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

  const tabs = shellLinks.filter((l) => l.to !== '/settings');

  return (
    <>
      {shell && (
        <Box
          component="header"
          sx={{
            position: 'fixed',
            inset: '0 0 auto 0',
            height: BAR_H,
            zIndex: 1100,
            bgcolor: colors.paper,
            borderBottom: `1px solid ${colors.divider}`,
          }}
        >
          <Box
            sx={{
              maxWidth: 1100,
              mx: 'auto',
              height: '100%',
              px: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Typography
              component={Link}
              to="/"
              sx={{
                fontFamily: "'Spell of Asia', sans-serif",
                fontSize: 36,
                color: colors.text,
                textDecoration: 'none',
              }}
            >
              {shellCopy.brand}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {auth && (
              <Box
                component="nav"
                aria-label="Main navigation"
                sx={{ display: { xs: 'none', sm: 'flex' }, height: '100%', gap: 3 }}
              >
                {tabs.map((l) => {
                  const active = isActive(pathname, l.to);
                  return (
                    <ButtonBase
                      key={l.to}
                      component={Link}
                      to={l.to}
                      sx={{
                        height: '100%',
                        fontSize: 16,
                        fontWeight: active ? 700 : 500,
                        color: active ? colors.text : colors.textSecondary,
                        borderBottom: `3px solid ${active ? colors.primaryLight : 'transparent'}`,
                        borderTop: '3px solid transparent',
                        gap: 0.75,
                      }}
                    >
                      {l.label}
                      {l.to === '/test-words' && due > 0 && (
                        <Box
                          component="span"
                          sx={{
                            fontSize: 12,
                            px: 0.75,
                            borderRadius: 1,
                            bgcolor: colors.primaryLight,
                            color: colors.white,
                          }}
                        >
                          {due}
                        </Box>
                      )}
                    </ButtonBase>
                  );
                })}
              </Box>
            )}
            {auth && (
              <IconButton
                aria-label={shellCopy.account}
                onClick={(e) => setAccountEl(e.currentTarget)}
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: colors.text }}
              >
                <AccountCircleOutlinedIcon />
              </IconButton>
            )}
            {!auth && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={props.onLogin} sx={{ color: colors.text }}>
                  {shellCopy.login}
                </Button>
                <Button
                  onClick={props.onRegister}
                  variant="outlined"
                  sx={{ color: colors.text, borderColor: colors.text }}
                >
                  {shellCopy.signUp}
                </Button>
              </Box>
            )}
            {auth && (
              <IconButton
                aria-label={shellCopy.menu}
                onClick={() => setMenuOpen(true)}
                sx={{ display: { xs: 'inline-flex', sm: 'none' }, color: colors.text }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Box>
          {props.notification && (
            <Box
              role="alert"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                minHeight: 40,
                px: 2,
                bgcolor: toastColors[props.notification.severity].bg,
                color: toastColors[props.notification.severity].fg,
                fontWeight: 600,
              }}
            >
              {props.notification.message}
              <ButtonBase
                onClick={props.onDismissNotification}
                sx={{ fontSize: 13, textDecoration: 'underline', color: 'inherit' }}
              >
                {shellCopy.dismiss}
              </ButtonBase>
            </Box>
          )}
        </Box>
      )}

      <Menu anchorEl={accountEl} open={!!accountEl} onClose={() => setAccountEl(null)}>
        <MenuItem component={Link} to="/settings" onClick={() => setAccountEl(null)}>
          {shellCopy.settings}
        </MenuItem>
        <MenuItem
          onClick={() => {
            props.onOpenShortcuts();
            setAccountEl(null);
          }}
        >
          {shellCopy.shortcuts}
        </MenuItem>
        <MenuItem
          onClick={() => {
            props.onLogout();
            setAccountEl(null);
          }}
        >
          {shellCopy.logout}
        </MenuItem>
      </Menu>

      <Dialog
        fullScreen
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        PaperProps={{ sx: { bgcolor: colors.paper, borderRadius: 0 } }}
      >
        <Box
          sx={{
            height: BAR_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: 2,
          }}
        >
          <IconButton
            aria-label={shellCopy.closeMenu}
            onClick={() => setMenuOpen(false)}
            sx={{ color: colors.text }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box
          component="nav"
          aria-label="Main navigation"
          sx={{ px: 4, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {shellLinks.map((l) => {
            const active = isActive(pathname, l.to);
            return (
              <ButtonBase
                key={l.to}
                component={Link}
                to={l.to}
                onClick={() => setMenuOpen(false)}
                sx={{
                  justifyContent: 'flex-start',
                  alignItems: 'baseline',
                  gap: 2,
                  py: 1.5,
                  borderBottom: `1px solid ${colors.divider}`,
                }}
              >
                <Box
                  sx={{
                    fontFamily: fonts.hanzi,
                    fontSize: 40,
                    color: active ? colors.primaryLight : colors.text,
                  }}
                >
                  {l.hanzi}
                </Box>
                <Box sx={{ fontSize: 16, color: colors.textSecondary }}>{l.label}</Box>
                {l.to === '/test-words' && due > 0 && (
                  <Box
                    sx={{ ml: 'auto', fontSize: 14, color: colors.primaryLight, fontWeight: 700 }}
                  >
                    {shellCopy.due(due)}
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ mt: 'auto', p: 4, display: 'flex', gap: 3 }}>
          <ButtonBase
            onClick={() => {
              props.onOpenShortcuts();
              setMenuOpen(false);
            }}
            sx={{ color: colors.textSecondary }}
          >
            {shellCopy.shortcuts}
          </ButtonBase>
          <ButtonBase
            onClick={() => {
              props.onLogout();
              setMenuOpen(false);
            }}
            sx={{ color: colors.textSecondary }}
          >
            {shellCopy.logout}
          </ButtonBase>
        </Box>
      </Dialog>

      <Box
        id="main-content"
        component="main"
        sx={{
          pt: shell ? `${BAR_H + (props.notification ? 40 : 0) + 24}px` : 0,
          px: shell ? 2 : 0,
          pb: 6,
        }}
      >
        <Box sx={{ maxWidth: shell ? COLUMN : '100%', mx: 'auto' }}>{body}</Box>
      </Box>
    </>
  );
};

export default ShellVariantB;
