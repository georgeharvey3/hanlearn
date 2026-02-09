import React from 'react';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { NavLink } from 'react-router-dom';

import NavigationItem from './NavigationItem/NavigationItem';
import Dropdown from './Dropdown/Dropdown';

interface NavigationItemsProps {
  authenticated?: boolean;
  isSideDrawer?: boolean;
}

const NavigationItems: React.FC<NavigationItemsProps> = (props) => {
  // Side drawer uses MUI List
  if (props.isSideDrawer) {
    const links = props.authenticated
      ? [
          { to: '/', label: 'Home' },
          { to: '/add-words', label: 'Add' },
          { to: '/test-words', label: 'Test' },
          { to: '/settings', label: 'Settings' },
          { to: '/logout', label: 'Logout' },
        ]
      : [
          { to: '/', label: 'Home' },
          { to: '/auth', label: 'Login' },
          { to: '/register', label: 'Register' },
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
                color: '#E6E0AE',
                '&.active': { color: '#AA381E' },
              }}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    );
  }

  // Desktop nav bar
  if (props.authenticated) {
    return (
      <Stack direction="row" alignItems="center" sx={{ height: '100%' }}>
        <NavigationItem link="/">Home</NavigationItem>
        <NavigationItem link="/add-words">Add</NavigationItem>
        <NavigationItem link="/test-words">Test</NavigationItem>
        <Dropdown />
        <NavigationItem link="/logout">Logout</NavigationItem>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" sx={{ height: '100%' }}>
      <NavigationItem link="/">Home</NavigationItem>
      <NavigationItem link="/auth">Login</NavigationItem>
      <NavigationItem link="/register">Register</NavigationItem>
    </Stack>
  );
};

export default NavigationItems;
