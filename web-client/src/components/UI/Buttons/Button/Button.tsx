import React, { ReactNode, CSSProperties } from 'react';
import MuiButton from '@mui/material/Button';

interface ButtonProps {
  id?: string;
  colour?: 'red' | 'yellow';
  disabled?: boolean;
  clicked?: () => void;
  style?: CSSProperties;
  children?: ReactNode;
}

const Button: React.FC<ButtonProps> = (props) => {
  const color = props.colour === 'red' ? 'primary' : 'secondary';

  return (
    <MuiButton
      id={props.id}
      variant="contained"
      color={color}
      disabled={props.disabled}
      onClick={props.clicked}
      style={props.style}
      sx={{ m: '8px 15px' }}
    >
      {props.children}
    </MuiButton>
  );
};

export default Button;
