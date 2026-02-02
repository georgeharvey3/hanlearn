import React from 'react';

import classes from './DrawerToggle.module.css';

interface DrawerToggleProps {
  clicked?: () => void;
}

const DrawerToggle: React.FC<DrawerToggleProps> = (props) => (
  <div onClick={props.clicked} className={classes.DrawerToggle}>
    <div />
    <div />
    <div />
  </div>
);

export default DrawerToggle;
