import React from 'react';

import classes from './Footer.module.css';

const footer = () => (
    <div className={classes.Footer}>
        <p>HanLearn is a free, open source application. Please send any feedback/suggestions to hanlearnapp AT gmail.com</p>
        <hr/>
        <p>© <a href="https://github.com/georgeharvey3">George Harvey</a> 2020</p>

    </div>
);

export default footer