import React from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface RemoveProps {
  clicked?: () => void;
}

const Remove: React.FC<RemoveProps> = (props) => (
  <IconButton onClick={props.clicked} aria-label="Remove word" size="small" sx={{ color: 'error.main' }}>
    <CloseIcon fontSize="small" />
  </IconButton>
);

export default Remove;
