import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import classes from './NavigationItem.module.css';

interface NavigationItemProps {
  link: string;
  children?: ReactNode;
}

const NavigationItem: React.FC<NavigationItemProps> = (props) => (
  <li className={classes.NavigationItem}>
    <NavLink to={props.link} exact activeClassName={classes.active}>
      {props.children}
    </NavLink>
  </li>
);

export default NavigationItem;
