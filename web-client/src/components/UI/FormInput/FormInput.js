import React from 'react';

import classes from './FormInput.module.css';

const formInput = props => {
    let inputElement = null;
    const inputClasses = [classes.InputElement];

    if (props.invalid && props.shouldValidate && props.touched) {
        inputClasses.push(classes.Invalid);
    }

    if (!props.invalid && props.shouldValidate && props.touched) {
        inputClasses.push(classes.Valid);
    }

    switch (props.elementType) {
        case ('input'):
            inputElement = <input
                className={inputClasses.join(' ')}
                {...props.elementConfig}
                value={props.value}
                onChange={props.changed} />;
            break;
        case ('textarea'):
            inputElement = <textarea
                className={inputClasses.join(' ')}
                {...props.elementConfig}
                onChange={props.changed}/>;
            break;
        case ('select'):
            inputElement = (
                <select
                    className={inputClasses.join(' ')}
                    value={props.changed}>
                        {props.elementConfig.options.map(option => (
                            <option
                                key={option.value}
                                value={option.value}>
                                    {option.displayValue}
                            </option>
                        ))}
                    </select>);
            break;
        default:
            inputElement = <input
                className={classes.InputElement}
                {...props.elementConfig}
                onChange={props.changed} />;
    }

    let validationError = null;

    if (props.invalid && props.touched) {
        validationError = <p className={classes.ValidationError}>{props.errorMessage}</p>;
    }

    return (
        <div className={classes.FormInput}>
            <label className={classes.Label}>{props.label}</label>
            {inputElement}
            {validationError}
        </div>
    );
}

export default formInput;