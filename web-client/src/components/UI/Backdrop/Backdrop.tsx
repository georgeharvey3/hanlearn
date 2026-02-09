import React from 'react';
import MuiBackdrop from '@mui/material/Backdrop';

interface BackdropProps {
  show?: boolean;
  clicked?: () => void;
}

const Backdrop: React.FC<BackdropProps> = (props) => (
  <MuiBackdrop
    open={!!props.show}
    onClick={props.clicked}
    sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
  />
);

export default Backdrop;
