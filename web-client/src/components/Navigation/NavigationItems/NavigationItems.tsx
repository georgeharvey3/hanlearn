import React from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { NavLink } from 'react-router-dom';
import { connect, ConnectedProps } from 'react-redux';

import NavigationItem from './NavigationItem/NavigationItem';
import Dropdown from './Dropdown/Dropdown';
import * as actions from '../../../store/actions/index';

const mapDispatchToProps = {
  onOpenAuthModal: actions.openAuthModal,
  onLogout: actions.logout,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface NavigationItemsProps {
  authenticated?: boolean;
  isSideDrawer?: boolean;
  textColor?: string;
  drawerClosed?: () => void;
}

type Props = NavigationItemsProps & PropsFromRedux;

const NavigationItems: React.FC<Props> = (props) => {
  // Side drawer uses MUI List
  if (props.isSideDrawer) {
    if (props.authenticated) {
      const links = [
        { to: '/', label: 'Home' },
        { to: '/add-words', label: 'Add' },
        { to: '/test-words', label: 'Test' },
        { to: '/settings', label: 'Settings' },
      ];

      return (
        <List>
          {links.map((link) => (
            <ListItem key={link.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={link.to}
                exact
                sx={{
                  color: 'common.white',
                  '&.active': { color: 'primary.main' },
                }}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            </ListItem>
          ))}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                props.onLogout();
                props.drawerClosed?.();
              }}
              sx={{ color: 'common.white' }}
            >
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
      );
    }

    const unauthLinks = [
      { to: '/', label: 'Home' },
    ];

    return (
      <List>
        {unauthLinks.map((link) => (
          <ListItem key={link.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={link.to}
              exact
              sx={{
                color: 'common.white',
                '&.active': { color: 'primary.main' },
              }}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              props.onOpenAuthModal('login');
              props.drawerClosed?.();
            }}
            sx={{ color: 'common.white' }}
          >
            <ListItemText primary="Login" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              props.onOpenAuthModal('register');
              props.drawerClosed?.();
            }}
            sx={{ color: 'common.white' }}
          >
            <ListItemText primary="Register" />
          </ListItemButton>
        </ListItem>
      </List>
    );
  }

  // Desktop nav bar
  if (props.authenticated) {
    return (
      <Stack direction="row" alignItems="center" sx={{ height: '100%' }}>
        <NavigationItem link="/" textColor={props.textColor}>Home</NavigationItem>
        <NavigationItem link="/add-words" textColor={props.textColor}>Add</NavigationItem>
        <NavigationItem link="/test-words" textColor={props.textColor}>Test</NavigationItem>
        <Dropdown textColor={props.textColor} />
        <Button
          onClick={() => props.onLogout()}
          sx={{ color: props.textColor, mx: 1 }}
        >
          Logout
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" sx={{ height: '100%' }}>
      <Button
        onClick={() => props.onOpenAuthModal('login')}
        sx={{ color: props.textColor, mx: 1, fontSize: '1rem' }}
      >
        Login
      </Button>
    </Stack>
  );
};

export default connector(NavigationItems);
