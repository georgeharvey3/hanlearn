import React from 'react';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface DrawerToggleProps {
  clicked?: () => void;
  textColor?: string;
}

const DrawerToggle: React.FC<DrawerToggleProps> = (props) => (
  <IconButton
    onClick={props.clicked}
    sx={{ display: { sm: 'none' }, color: props.textColor ?? 'common.white' }}
    edge="start"
  >
    <MenuIcon />
  </IconButton>
);

export default DrawerToggle;
