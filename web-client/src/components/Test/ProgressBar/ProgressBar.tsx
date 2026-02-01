import React from 'react';

import classes from './ProgressBar.module.css';

interface ProgressBarProps {
  progress?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = (props) => (
  <div className={classes.ProgressBar}>
    <div className={classes.InnerBar}>
      <div
        className={classes.InnerInner}
        style={{ width: `${props.progress}%` }}
      ></div>
    </div>
  </div>
);

export default ProgressBar;
