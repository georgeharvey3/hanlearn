import React, { ChangeEvent, KeyboardEvent, FocusEvent, CSSProperties } from 'react';
import TextField from '@mui/material/TextField';

interface InputProps {
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
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
  maxLength?: number;
  style?: CSSProperties;
}

const Input: React.FC<InputProps> = (props) => (
  <TextField
    id={props.id}
    placeholder={props.placeholder}
    onChange={props.changed}
    onKeyPress={props.keyPressed}
    value={props.value}
    onFocus={props.focussed}
    onBlur={props.blurred}
    autoFocus={props.autoFocus}
    autoComplete={props.autoComplete}
    variant="outlined"
    size="small"
    slotProps={{
      htmlInput: {
        'aria-label': props['aria-label'],
        autoCorrect: props.autoCorrect,
        autoCapitalize: props.autoCapitalize,
        spellCheck: props.spellCheck,
        maxLength: props.maxLength,
      },
    }}
    style={props.style}
    sx={{
      width: '75%',
      maxWidth: 400,
      mx: 'auto',
      '& input': { textAlign: 'center' },
    }}
  />
);

export default Input;
