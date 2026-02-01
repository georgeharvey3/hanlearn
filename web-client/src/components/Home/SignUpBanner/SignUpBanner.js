import React from 'react';

import classes from './SignUpBanner.module.css';

import Button from '../../UI/Buttons/Button/Button';

const signUpBanner = props => (
    <div className={classes.SignUpBanner}>
        <h3>Join HanLearn!</h3>
        <p>Create a free account to edit translations, add your own words and practise with spaced repitition.</p>
        <div style={{display: 'flex', justifyContent: 'center'}}>
            <Button colour='red' clicked={props.tryOutClicked}>Try it out</Button>
            <Button colour='red' clicked={props.signUpClicked}>Sign Up</Button>
        </div>
    </div>
);

export default signUpBanner;