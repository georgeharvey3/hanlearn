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
    <Dialog open={!!props.show} onClose={props.modalClosed} maxWidth="sm" fullWidth>
      <Box sx={{ position: 'relative', p: 3 }}>
        <IconButton
          onClick={props.modalClosed}
          aria-label="Close dialog"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
          size="small"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        {props.children}
      </Box>
    </Dialog>
  );
};

export default Modal;
