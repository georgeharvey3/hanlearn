import React, { ReactNode, CSSProperties } from 'react';
import MuiButton from '@mui/material/Button';

type ButtonType = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  id?: string;
  type?: ButtonType;
  disabled?: boolean;
  clicked?: () => void;
  style?: CSSProperties;
  children?: ReactNode;
  'aria-pressed'?: boolean;
  'aria-label'?: string;
}

const buttonStyles: Record<ButtonType, object> = {
  primary: {
    bgcolor: 'primary.dark',
    color: '#fff',
    '&:hover': { bgcolor: '#145233' },
  },
  secondary: {
    bgcolor: 'primary.light',
    color: '#fff',
    '&:hover': { bgcolor: '#c94d62' },
  },
  ghost: {
    color: 'text.secondary',
    borderColor: 'divider',
  },
};

const Button: React.FC<ButtonProps> = (props) => {
  const { type = 'primary' } = props;
  const variant = type === 'ghost' ? 'outlined' : 'contained';

  return (
    <MuiButton
      id={props.id}
      variant={variant}
      disabled={props.disabled}
      onClick={props.clicked}
      style={props.style}
      aria-pressed={props['aria-pressed']}
      aria-label={props['aria-label']}
      sx={{ m: '8px 15px', ...buttonStyles[type] }}
    >
      {props.children}
    </MuiButton>
  );
};

export default Button;
