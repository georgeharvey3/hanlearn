import React from 'react';

import classes from './Backdrop.module.css';

interface BackdropProps {
  show?: boolean;
  clicked?: () => void;
}

const Backdrop: React.FC<BackdropProps> = (props) =>
  props.show ? (
    <div className={classes.Backdrop} onClick={props.clicked}></div>
  ) : null;

export default Backdrop;
