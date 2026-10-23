import React from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { CloseIcon } from '../Navigation/icons';
import { keyboardShortcuts } from '../../data/keyboardShortcuts';
import { colors, fonts, shadows, scrim } from '../../theme';
import { copy } from '../../copy';

interface Props {
  open: boolean;
  onClose: () => void;
}

const kbdSx = {
  minWidth: 28,
  height: 26,
  boxSizing: 'border-box',
  px: 1,
  border: `1px solid ${colors.borderStrong}`,
  borderBottomWidth: 2,
  borderRadius: 1,
  bgcolor: colors.paper,
  fontFamily: fonts.body,
  fontSize: 13,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const KeyboardShortcutsDialog: React.FC<Props> = ({ open, onClose }) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      aria-labelledby="keyboard-shortcuts-title"
      PaperProps={{
        sx: {
          maxWidth: 560,
          maxHeight: 'min(640px, calc(100% - 64px))',
          borderRadius: 1,
          boxShadow: shadows.dialog,
        },
      }}
      slotProps={{ backdrop: { sx: { bgcolor: scrim } } }}
    >
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          pl: 3,
          pr: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.divider}`,
        }}
      >
        <Box
          component="h2"
          id="keyboard-shortcuts-title"
          sx={{ m: 0, fontSize: 22, fontWeight: 600 }}
        >
          {copy.shell.shortcutsTitle}
        </Box>
        <ButtonBase
          aria-label={copy.shell.close}
          onClick={onClose}
          sx={{ width: 44, height: 44, borderRadius: '50%', color: colors.textSecondary }}
        >
          <CloseIcon size={20} />
        </ButtonBase>
      </Box>
      <Box
        sx={{
          overflowY: 'auto',
          px: 3,
          py: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          textAlign: 'left',
        }}
      >
        {keyboardShortcuts.map((group) => (
          <Box component="section" key={group.id}>
            <Box
              component="h3"
              sx={{
                m: 0,
                mb: 0.75,
                fontSize: 12,
                fontWeight: 600,
                color: colors.textSecondary,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {group.label}
            </Box>
            {group.shortcuts.map((shortcut) => (
              <Box
                key={`${group.id}-${shortcut.keys}-${shortcut.description}`}
                sx={{
                  minHeight: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  fontSize: 15,
                }}
              >
                <span>
                  {shortcut.description}
                  {shortcut.context && (
                    <Box
                      component="span"
                      sx={{ ml: 0.75, fontSize: 13, color: colors.textSecondary }}
                    >
                      {shortcut.context}
                    </Box>
                  )}
                </span>
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
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
      </Box>
    </Dialog>
  );
};

export default KeyboardShortcutsDialog;
