import React from 'react';

import Settings from '../../../Settings/Settings';

import classes from './Dropdown.module.css';

const Dropdown: React.FC = () => {
  return (
    <div className={classes.Dropdown}>
      <button className={classes.Dropbtn}>Settings</button>
      <div className={classes.DropdownContent}>
        <Settings />
      </div>
    </div>
  );
};

export default Dropdown;
