import React from 'react';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface DrawerToggleProps {
  clicked?: () => void;
}

const DrawerToggle: React.FC<DrawerToggleProps> = (props) => (
  <IconButton
    onClick={props.clicked}
    sx={{ display: { sm: 'none' }, color: '#AA381E' }}
    edge="start"
  >
    <MenuIcon />
  </IconButton>
);

export default DrawerToggle;
