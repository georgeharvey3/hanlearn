import React, { CSSProperties } from 'react';

import classes from './Spinner.module.css';

interface SpinnerProps {
  style?: CSSProperties;
}

const Spinner: React.FC<SpinnerProps> = (props) => (
  <div className={classes.Loader} style={props.style}>
    Loading...
  </div>
);

export default Spinner;
