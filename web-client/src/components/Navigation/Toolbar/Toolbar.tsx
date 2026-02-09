import React from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import MuiToolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import Logo from '../../Logo/Logo';
import NavigationItems from '../NavigationItems/NavigationItems';
import DrawerToggle from '../SideDrawer/DrawerToggle/DrawerToggle';

interface ToolbarProps extends RouteComponentProps {
  drawerToggleClicked?: () => void;
  isAuth?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = (props) => (
  <AppBar position="fixed" sx={{ backgroundColor: '#E6E0AE', boxShadow: 1 }}>
    <MuiToolbar sx={{ minHeight: 56 }}>
      <DrawerToggle clicked={props.drawerToggleClicked} />
      <Typography
        variant="h6"
        sx={{ display: { xs: 'block', sm: 'none' }, color: '#AA381E', flexGrow: 1 }}
      >
        HanLearn
      </Typography>
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          height: 56,
          cursor: 'pointer',
        }}
        onClick={() => props.history.push('/')}
      >
        <Logo colour="red" />
        <Typography variant="subtitle1" sx={{ color: '#AA381E', ml: 0.5 }}>
          HanLearn
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, height: '100%' }}>
        <NavigationItems authenticated={props.isAuth} />
      </Box>
    </MuiToolbar>
  </AppBar>
);

export default withRouter(Toolbar);
