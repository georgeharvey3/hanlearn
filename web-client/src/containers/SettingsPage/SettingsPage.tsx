import React from 'react';

import Settings from '../../components/Settings/Settings';

import classes from './SettingsPage.module.css';

const SettingsPage: React.FC = () => {
  return (
    <div className={classes.SettingsPage}>
      <h2>Settings</h2>
      <div className={classes.Settings}>
        <Settings />
      </div>
    </div>
  );
};

export default SettingsPage;
