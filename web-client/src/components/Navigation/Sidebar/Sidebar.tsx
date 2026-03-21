import React from 'react';
import { NavLink } from 'react-router-dom';
import { connect, ConnectedProps } from 'react-redux';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddIcon from '@mui/icons-material/Add';
import QuizIcon from '@mui/icons-material/Quiz';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import KeyboardIcon from '@mui/icons-material/Keyboard';

import * as actions from '../../../store/actions/index';
import { colors } from '../../../theme';

export const SIDEBAR_WIDTH = 240;

const mapDispatchToProps = {
  onLogout: actions.logout,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  onOpenShortcuts?: () => void;
}

const links = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/add-words', label: 'Add Words', icon: <AddIcon /> },
  { to: '/test-words', label: 'Test', icon: <QuizIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

const Sidebar: React.FC<PropsFromRedux & OwnProps> = ({ onLogout, onOpenShortcuts }) => {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        display: { xs: 'none', sm: 'block' },
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: colors.primary,
          borderRight: 'none',
          top: 56,
          height: 'calc(100% - 56px)',
        },
      }}
    >
      <Box
        component="nav"
        aria-label="Main navigation"
        sx={{
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          pt: 1,
        }}
      >
        <List sx={{ flex: 1, px: 1 }}>
          {links.map((link) => (
            <ListItem key={link.to} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={link.to}
                exact
                sx={{
                  color: colors.text,
                  borderRadius: 2,
                  py: 1.2,
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.06)',
                  },
                  '&.active': {
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    fontWeight: 600,
                    '& .MuiListItemIcon-root': {
                      color: colors.primaryDark,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{link.icon}</ListItemIcon>
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{ fontWeight: 'inherit' }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider sx={{ borderColor: 'rgba(0,0,0,0.12)', mx: 1 }} />
        <List sx={{ px: 1, pb: 1 }}>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={onOpenShortcuts}
              sx={{
                color: colors.text,
                borderRadius: 2,
                py: 1.2,
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.06)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                <KeyboardIcon />
              </ListItemIcon>
              <ListItemText primary="Shortcuts" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton
              onClick={onLogout}
              sx={{
                color: colors.text,
                borderRadius: 2,
                py: 1.2,
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.06)',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
};

export default connector(Sidebar);
