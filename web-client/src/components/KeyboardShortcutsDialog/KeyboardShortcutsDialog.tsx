import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { keyboardShortcuts } from '../../data/keyboardShortcuts';

interface Props {
  open: boolean;
  onClose: () => void;
}

const kbdSx = {
  display: 'inline-block',
  px: 0.8,
  py: 0.25,
  border: '1px solid',
  borderColor: 'grey.400',
  borderRadius: 1,
  backgroundColor: 'grey.100',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  lineHeight: 1.5,
  minWidth: 24,
  textAlign: 'center' as const,
};

const KeyboardShortcutsDialog: React.FC<Props> = ({ open, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <DialogTitle
        id="keyboard-shortcuts-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}
      >
        Keyboard Shortcuts
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pb: 3 }}>
        {keyboardShortcuts.map((group) => (
          <Box key={group.id} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'text.secondary' }}>
              {group.label}
            </Typography>
            {group.shortcuts.map((shortcut) => (
              <Box
                key={`${group.id}-${shortcut.keys}-${shortcut.description}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.5,
                  px: 1,
                  '&:hover': { backgroundColor: 'action.hover', borderRadius: 1 },
                }}
              >
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {shortcut.description}
                  {shortcut.context && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'text.disabled' }}>
                      ({shortcut.context})
                    </Typography>
                  )}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, ml: 2, flexShrink: 0 }}>
                  {shortcut.keys.split('+').map((part) => (
                    <Box component="kbd" key={part} sx={kbdSx}>
                      {part}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.disabled', textAlign: 'center' }}>
          Press <Box component="kbd" sx={{ ...kbdSx, fontSize: '0.7rem' }}>?</Box> to toggle this dialog from anywhere
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;
