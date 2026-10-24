import React, { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import ButtonBase from '@mui/material/ButtonBase';
import Box from '@mui/material/Box';

import { CloseIcon } from '../../Navigation/icons';
import { colors, shadows, scrim } from '../../../theme';
import { copy } from '../../../copy';

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
      PaperProps={{
        sx: { borderRadius: 1, boxShadow: shadows.dialog },
      }}
      slotProps={{ backdrop: { sx: { bgcolor: scrim } } }}
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
