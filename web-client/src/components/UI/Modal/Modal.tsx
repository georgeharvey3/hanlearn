import React, { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import Box from '@mui/material/Box';

import { CloseIcon } from '../../Navigation/icons';
import { colors } from '../../../theme';
import { copy } from '../../../copy';

interface ModalProps {
  show?: boolean;
  modalClosed?: () => void;
  children?: ReactNode;
}

// The same card and scrim as the shortcuts dialog.
const Modal: React.FC<ModalProps> = (props) => {
  return (
    <Dialog
      open={!!props.show}
      onClose={props.modalClosed}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, boxShadow: '0 20px 48px -20px rgba(70,50,30,0.45)' },
      }}
      slotProps={{ backdrop: { sx: { bgcolor: 'rgba(43,38,34,0.42)' } } }}
    >
      <Box sx={{ position: 'relative', p: 3 }}>
        <ButtonBase
          onClick={props.modalClosed}
          aria-label={copy.shell.close}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 44,
            height: 44,
            borderRadius: '50%',
            color: colors.textSecondary,
            '&:hover': { color: colors.text },
          }}
        >
          <CloseIcon size={20} />
        </ButtonBase>
        {props.children}
      </Box>
    </Dialog>
  );
};

export default Modal;
