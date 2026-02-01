import React from 'react';

import classes from './Buttons.module.css';

import Button from './Button/Button';

const buttons = props => {
    let buttonElems = props.children.map((button, index) => (
        <Button 
            key={index}
            clicked={props.clickedHandlers[index]}>{button}</Button>
    ));
    return (
        <div className={classes.Buttons}>
            {buttonElems}
        </div>
    );
}

export default buttons;