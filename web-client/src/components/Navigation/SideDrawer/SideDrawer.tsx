import React from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';

import Logo from '../../Logo/Logo';
import NavigationItems from '../NavigationItems/NavigationItems';

interface SideDrawerProps {
  open?: boolean;
  closed?: () => void;
  isAuth?: boolean;
}

const SideDrawer: React.FC<SideDrawerProps> = (props) => {
  return (
    <Drawer
      anchor="left"
      open={!!props.open}
      onClose={props.closed}
      sx={{
        display: { sm: 'none' },
        '& .MuiDrawer-paper': {
          width: 200,
          maxWidth: '70%',
          backgroundColor: 'rgb(46, 66, 66)',
        },
      }}
    >
      <Box sx={{ height: 56, display: 'flex', justifyContent: 'center' }}>
        <Logo />
      </Box>
      <nav>
        <NavigationItems authenticated={props.isAuth} isSideDrawer />
      </nav>
    </Drawer>
  );
};

export default SideDrawer;
