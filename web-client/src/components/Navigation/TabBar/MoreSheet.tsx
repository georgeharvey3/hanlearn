import React from 'react';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Drawer from '@mui/material/Drawer';

import { ShortcutsIcon, LogoutIcon } from '../icons';
import * as actions from '../../../store/actions/index';
import { AppDispatch } from '../../../types/actions';
import { colors, fonts, scrim } from '../../../theme';
import { copy } from '../../../copy';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenShortcuts: () => void;
}

const rowSx = {
  width: '100%',
  height: 56,
  px: 3,
  justifyContent: 'flex-start',
  gap: 2,
  fontFamily: fonts.body,
  fontSize: 17,
  color: colors.text,
  textDecoration: 'none',
};

/** The sheet that the phone's More tab opens: Shortcuts and Log out. */
const MoreSheet: React.FC<Props> = ({ open, onClose, onOpenShortcuts }) => {
  const dispatch = useDispatch<AppDispatch>();

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ backdrop: { sx: { bgcolor: scrim } } }}
      PaperProps={{
        role: 'dialog',
        'aria-label': copy.shell.more,
        sx: {
          borderRadius: '4px 4px 0 0',
          bgcolor: colors.paper,
          boxShadow: '0 -12px 32px -16px rgba(70,50,30,0.45)',
          pb: 'calc(16px + env(safe-area-inset-bottom))',
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 4,
          borderRadius: 1,
          bgcolor: colors.borderStrong,
          mx: 'auto',
          mt: 1.5,
          mb: 1,
        }}
      />
      <ButtonBase
        onClick={() => {
          onClose();
          onOpenShortcuts();
        }}
        sx={rowSx}
      >
        <ShortcutsIcon />
        {copy.shell.shortcuts}
      </ButtonBase>
      <Box sx={{ height: '1px', mx: 3, my: 0.5, bgcolor: colors.divider }} />
      <ButtonBase
        onClick={() => {
          onClose();
          dispatch(actions.logout());
        }}
        sx={rowSx}
      >
        <LogoutIcon />
        {copy.shell.logout}
      </ButtonBase>
    </Drawer>
  );
};

export default MoreSheet;
