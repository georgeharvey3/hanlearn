import React, { ChangeEvent } from 'react';

import classes from './FormInput.module.css';

interface ElementConfig {
  type?: string;
  placeholder?: string;
  options?: Array<{ value: string; displayValue: string }>;
}

interface FormInputProps {
  elementType?: 'input' | 'textarea' | 'select';
  elementConfig?: ElementConfig;
  value?: string;
  changed?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  invalid?: boolean;
  shouldValidate?: boolean;
  touched?: boolean;
  errorMessage?: string;
  label?: string;
}

const FormInput: React.FC<FormInputProps> = (props) => {
  let inputElement: React.ReactNode = null;
  const inputClasses = [classes.InputElement];

  if (props.invalid && props.shouldValidate && props.touched) {
    inputClasses.push(classes.Invalid);
  }

  if (!props.invalid && props.shouldValidate && props.touched) {
    inputClasses.push(classes.Valid);
  }

  switch (props.elementType) {
    case 'input':
      inputElement = (
        <input
          className={inputClasses.join(' ')}
          {...props.elementConfig}
          value={props.value}
          onChange={props.changed}
        />
      );
      break;
    case 'textarea':
      inputElement = (
        <textarea
          className={inputClasses.join(' ')}
          {...props.elementConfig}
          onChange={props.changed}
        />
      );
      break;
    case 'select':
      inputElement = (
        <select className={inputClasses.join(' ')} onChange={props.changed}>
          {props.elementConfig?.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.displayValue}
            </option>
          ))}
        </select>
      );
      break;
    default:
      inputElement = (
        <input
          className={classes.InputElement}
          {...props.elementConfig}
          onChange={props.changed}
        />
      );
  }

  let validationError: React.ReactNode = null;

  if (props.invalid && props.touched) {
    validationError = (
      <p className={classes.ValidationError}>{props.errorMessage}</p>
    );
  }

  return (
    <div className={classes.FormInput}>
      <label className={classes.Label}>{props.label}</label>
      {inputElement}
      {validationError}
    </div>
  );
};

export default FormInput;
