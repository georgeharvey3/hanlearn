import React, { CSSProperties } from 'react';
import IconButton from '@mui/material/IconButton';

type ButtonType = 'primary' | 'secondary' | 'ghost';

interface PictureButtonProps {
  type?: ButtonType;
  style?: CSSProperties;
  clicked?: () => void;
  src?: string;
  'aria-label'?: string;
}

const buttonStyles: Record<ButtonType, { bg: string; hover: string; invert: boolean }> = {
  primary: { bg: 'primary.dark', hover: '#145233', invert: true },
  secondary: { bg: 'primary.light', hover: '#c94d62', invert: true },
  ghost: { bg: 'grey', hover: 'grey', invert: false },
};

const PictureButton: React.FC<PictureButtonProps> = (props) => {
  const { type = 'secondary' } = props;
  const { bg, hover, invert } = buttonStyles[type];

  return (
    <IconButton
      onClick={props.clicked}
      aria-label={props['aria-label'] || 'Action button'}
      style={props.style}
      sx={{
        backgroundColor: bg,
        '&:hover': { backgroundColor: hover, opacity: 0.85 },
        width: 40,
        height: 40,
      }}
    >
      <img src={props.src} alt="" style={{ width: 20, height: 20, filter: invert ? 'brightness(0) invert(1)' : undefined }} />
    </IconButton>
  );
};

export default PictureButton;
