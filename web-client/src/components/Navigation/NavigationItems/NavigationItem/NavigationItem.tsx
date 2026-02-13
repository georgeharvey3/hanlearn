import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import MuiButton from '@mui/material/Button';

interface NavigationItemProps {
  link: string;
  children?: ReactNode;
  textColor?: string;
}

const NavigationItem: React.FC<NavigationItemProps> = (props) => (
  <MuiButton
    component={NavLink}
    to={props.link}
    exact
    sx={{
      color: props.textColor ?? 'common.white',
      textTransform: 'none',
      px: 1.5,
      borderBottom: '4px solid transparent',
      borderRadius: 0,
      '&.active': {
        borderBottom: `4px solid ${props.textColor ?? 'white'}`,
      },
    }}
  >
    {props.children}
  </MuiButton>
);

export default NavigationItem;
