import React, { ChangeEvent } from 'react';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

interface ToggleProps {
  checked?: boolean;
  changed?: (e: ChangeEvent<HTMLInputElement>) => void;
}

const Toggle: React.FC<ToggleProps> = (props) => {
  return (
    <FormControlLabel
      control={
        <Switch
          checked={props.checked}
          onChange={props.changed}
          color="primary"
        />
      }
      label="Auto Record:"
      labelPlacement="start"
      sx={{ color: 'text.primary' }}
    />
  );
};

export default Toggle;
