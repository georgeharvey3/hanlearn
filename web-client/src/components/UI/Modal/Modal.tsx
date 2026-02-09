import React, { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';

interface ModalProps {
  show?: boolean;
  modalClosed?: () => void;
  children?: ReactNode;
}

const Modal: React.FC<ModalProps> = (props) => {
  return (
    <Dialog
      open={!!props.show}
      onClose={props.modalClosed}
      maxWidth="sm"
      fullWidth
    >
      <Box sx={{ position: 'relative', p: 2 }}>
        <IconButton
          onClick={props.modalClosed}
          sx={{ position: 'absolute', top: 8, right: 8 }}
          size="small"
        >
          <CloseIcon sx={{ color: '#E6E0AE' }} />
        </IconButton>
        {props.children}
      </Box>
    </Dialog>
  );
};

export default Modal;
