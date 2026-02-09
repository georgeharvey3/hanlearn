import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import MuiButton from '@mui/material/Button';

interface NavigationItemProps {
  link: string;
  children?: ReactNode;
}

const NavigationItem: React.FC<NavigationItemProps> = (props) => (
  <MuiButton
    component={NavLink}
    to={props.link}
    exact
    sx={{
      color: '#AA381E',
      textTransform: 'none',
      px: 1.5,
      '&.active': {
        borderBottom: '4px solid #AA381E',
        borderRadius: 0,
      },
    }}
  >
    {props.children}
  </MuiButton>
);

export default NavigationItem;
