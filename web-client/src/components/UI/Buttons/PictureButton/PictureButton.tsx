import React, { CSSProperties } from 'react';
import IconButton from '@mui/material/IconButton';

interface PictureButtonProps {
  colour?: 'red' | 'yellow' | 'grey';
  style?: CSSProperties;
  clicked?: () => void;
  src?: string;
}

const colorMap = {
  red: '#AA381E',
  yellow: '#E6E0AE',
  grey: 'grey',
};

const PictureButton: React.FC<PictureButtonProps> = (props) => {
  const bgColor = colorMap[props.colour || 'yellow'];

  return (
    <IconButton
      onClick={props.clicked}
      style={props.style}
      sx={{
        backgroundColor: bgColor,
        '&:hover': { backgroundColor: bgColor, opacity: 0.85 },
        width: 40,
        height: 40,
      }}
    >
      <img src={props.src} alt="sound" style={{ width: 20, height: 20 }} />
    </IconButton>
  );
};

export default PictureButton;
