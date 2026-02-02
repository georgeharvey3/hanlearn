import React, { ChangeEvent, KeyboardEvent, FocusEvent, CSSProperties } from 'react';

import classes from './Input.module.css';

interface InputProps {
  id?: string;
  placeholder?: string;
  changed?: (e: ChangeEvent<HTMLInputElement>) => void;
  keyPressed?: (e: KeyboardEvent<HTMLInputElement>) => void;
  value?: string;
  focussed?: (e: FocusEvent<HTMLInputElement>) => void;
  blurred?: (e: FocusEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  style?: CSSProperties;
}

const Input: React.FC<InputProps> = (props) => (
  <input
    className={classes.Input}
    type="text"
    id={props.id}
    placeholder={props.placeholder}
    onChange={props.changed}
    onKeyPress={props.keyPressed}
    value={props.value}
    onFocus={props.focussed}
    onBlur={props.blurred}
    autoFocus={props.autoFocus}
    autoComplete={props.autoComplete}
    autoCorrect={props.autoCorrect}
    autoCapitalize={props.autoCapitalize}
    spellCheck={props.spellCheck}
    style={props.style}
  />
);

export default Input;
