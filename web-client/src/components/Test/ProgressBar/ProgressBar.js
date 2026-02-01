import React from 'react';

import classes from './ProgressBar.module.css';

const progressBar = props => (
    <div className={classes.ProgressBar}>
        <div className={classes.InnerBar}>
            <div 
                className={classes.InnerInner}
                style={{width: `${props.progress}%`}}>

            </div>
        </div>
    </div>
)

export default progressBar;