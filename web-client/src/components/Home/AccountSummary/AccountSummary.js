import React from 'react';

import classes from './AccountSummary.module.css';

import Button from '../../UI/Buttons/Button/Button';

const accountSummary = props => (
    <div className={classes.AccountSummary}>
        <h3>You have {props.numDue}/{props.numTot} words due for testing...</h3>
        <Button 
            disabled={props.numDue === 0} 
            colour='red' 
            clicked={props.testClicked}>Test</Button>
    </div>
);

export default accountSummary;