import React from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

interface RemoveProps {
  clicked?: () => void;
}

const Remove: React.FC<RemoveProps> = (props) => (
  <IconButton onClick={props.clicked} size="small" sx={{ color: '#E6E0AE' }}>
    <CloseIcon fontSize="small" />
  </IconButton>
);

export default Remove;
