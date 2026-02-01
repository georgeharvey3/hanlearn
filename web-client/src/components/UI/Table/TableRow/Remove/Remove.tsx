import React from 'react';

import classes from './Remove.module.css';

interface RemoveProps {
  clicked?: () => void;
}

const Remove: React.FC<RemoveProps> = (props) => (
  <button className={classes.Remove} onClick={props.clicked}>
    ✕
  </button>
);

export default Remove;
