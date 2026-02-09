import React, { useState } from 'react';
import MuiButton from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import Paper from '@mui/material/Paper';

import Settings from '../../../Settings/Settings';

const Dropdown: React.FC = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <MuiButton
        onClick={handleClick}
        sx={{ color: '#AA381E', textTransform: 'none', px: 1.5 }}
      >
        Settings
      </MuiButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Paper sx={{ p: 2, minWidth: 200 }}>
          <Settings />
        </Paper>
      </Menu>
    </>
  );
};

export default Dropdown;
