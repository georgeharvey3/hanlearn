import React, { ChangeEvent } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';

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
  const showError = !!(props.invalid && props.shouldValidate && props.touched);
  const showSuccess = !!(!props.invalid && props.shouldValidate && props.touched);

  if (props.elementType === 'select') {
    return (
      <Box sx={{ mb: 2 }}>
        <TextField
          select
          label={props.label}
          value={props.value || ''}
          onChange={props.changed as any}
          error={showError}
          color={showSuccess ? 'success' : undefined}
          helperText={showError ? props.errorMessage : undefined}
          fullWidth
          size="small"
        >
          {props.elementConfig?.options?.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.displayValue}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <TextField
        type={props.elementConfig?.type || 'text'}
        placeholder={props.elementConfig?.placeholder}
        label={props.label}
        value={props.value || ''}
        onChange={props.changed}
        error={showError}
        color={showSuccess ? 'success' : undefined}
        helperText={showError ? props.errorMessage : undefined}
        multiline={props.elementType === 'textarea'}
        rows={props.elementType === 'textarea' ? 3 : undefined}
        fullWidth
        size="small"
      />
    </Box>
  );
};

export default FormInput;
