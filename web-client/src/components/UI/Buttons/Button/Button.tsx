import React, { ReactNode, CSSProperties } from 'react';
import MuiButton from '@mui/material/Button';
import { colors } from '../../../../theme';

type ButtonType = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  id?: string;
  type?: ButtonType;
  htmlType?: 'button' | 'submit' | 'reset';
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
    '&:hover': { bgcolor: colors.primaryDarkHover },
  },
  secondary: {
    bgcolor: 'primary.light',
    color: '#fff',
    '&:hover': { bgcolor: colors.primaryLightHover },
  },
  ghost: {
    color: 'text.primary',
    borderColor: colors.borderStrong,
    '&:hover': { borderColor: 'text.secondary', bgcolor: 'background.paper' },
  },
};

const Button: React.FC<ButtonProps> = (props) => {
  const { type = 'primary' } = props;
  const variant = type === 'ghost' ? 'outlined' : 'contained';

  return (
    <MuiButton
      id={props.id}
      type={props.htmlType}
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
