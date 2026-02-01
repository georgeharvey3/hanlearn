import React from 'react';

import classes from './Remove.module.css';

const remove = props => (
    <button 
        className={classes.Remove}
        onClick={props.clicked}>✕</button>
)

export default remove;