import React from 'react';

import classes from './Button.module.css';

const button = (props) => {
    let attachedClasses = [classes.Button, classes.Yellow];

    if (props.colour === 'red') {
        attachedClasses = [classes.Button, classes.Red];
    }

    if (props.disabled) {
        attachedClasses = [classes.Button, classes.Grey];
    }
            
    return (
        <button 
            id={props.id}
            className={attachedClasses.join(' ')}
            onClick={props.clicked}
            style={props.style}
            disabled={props.disabled}>
                {props.children}
        </button>
    );
}

export default button;