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

import * as actions from '../../../store/actions/index';
import { colors } from '../../../theme';

export const SIDEBAR_WIDTH = 240;

const mapDispatchToProps = {
  onLogout: actions.logout,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const links = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/add-words', label: 'Add Words', icon: <AddIcon /> },
  { to: '/test-words', label: 'Test', icon: <QuizIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

const Sidebar: React.FC<PropsFromRedux> = ({ onLogout }) => {
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
          borderRight: `1px solid ${colors.divider}`,
          top: 56,
          height: 'calc(100% - 56px)',
        },
      }}
    >
      <Box component="nav" aria-label="Main navigation" sx={{ overflow: 'auto' }}>
        <List>
          {links.map((link) => (
            <ListItem key={link.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={link.to}
                exact
                sx={{
                  color: colors.text,
                  '&.active': {
                    backgroundColor: 'rgba(0,0,0,0.08)',
                    borderRight: `3px solid ${colors.primaryDark}`,
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{link.icon}</ListItemIcon>
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={onLogout} sx={{ color: colors.text }}>
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
