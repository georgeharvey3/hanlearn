import React from 'react';

import classes from './Logo.module.css';

import hanLearnLogo from '../../assets/images/hlclearsq.png';
import hanLearnLogoRed from '../../assets/images/hlclearredsq.png';

const logo = (props) => {
    let logoVer = hanLearnLogo;

    if (props.colour === 'red') {
        logoVer = hanLearnLogoRed;
    }
    return (
        <div className={classes.Logo}>
            <img src={logoVer} alt="HanLearn"/>
        </div>
    );
};

export default logo;