import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { keyframes } from '@mui/material/styles';

import { colors, fonts } from '../../../theme';
import { copy } from '../../../copy';

const breathe = keyframes`
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
`;

interface LoadingProps {
  /** The size of the character in px. A page uses 96; a small slot less. */
  size?: number;
}

/** A large 学 that fades in and out while a page or a part of one loads. */
export const PageLoading: React.FC<LoadingProps> = ({ size = 96 }) => (
  <Box
    role="status"
    aria-label={copy.shell.loading}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: size >= 96 ? '50vh' : size * 1.5,
    }}
  >
    <Box
      component="span"
      lang="zh"
      aria-hidden="true"
      sx={{
        fontFamily: fonts.hanzi,
        fontSize: size,
        lineHeight: 1,
        color: colors.text,
        animation: `${breathe} 1.6s ease-in-out infinite`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.6 },
      }}
    >
      {copy.shell.loadingMark}
    </Box>
  </Box>
);

const actionSx = {
  height: 48,
  px: 3.5,
  boxSizing: 'border-box',
  borderRadius: 1,
  fontFamily: fonts.body,
  fontSize: 16,
  fontWeight: 600,
  textDecoration: 'none',
} as const;

interface ErrorProps {
  onRetry: () => void;
}

/** The red 错 stamp, a short message, "Try again" and "Home". */
export const PageError: React.FC<ErrorProps> = ({ onRetry }) => (
  <Box
    role="alert"
    sx={{
      minHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      color: colors.text,
    }}
  >
    <Box
      lang="zh"
      aria-hidden="true"
      sx={{
        width: 96,
        height: 96,
        boxSizing: 'border-box',
        border: `3px solid ${colors.primaryLight}`,
        borderRadius: 1,
        color: colors.primaryLight,
        fontFamily: fonts.hanzi,
        fontSize: 64,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-4deg)',
      }}
    >
      {copy.shell.errorStamp}
    </Box>
    <Box component="h1" sx={{ m: 0, mt: 3.5, fontSize: 22, fontWeight: 600 }}>
      {copy.shell.errorTitle}
    </Box>
    <Box component="p" sx={{ m: 0, mt: 1, fontSize: 16, color: colors.textSecondary }}>
      {copy.shell.errorBody}
    </Box>
    <Box sx={{ mt: 3.5, display: 'flex', gap: 1.5 }}>
      <ButtonBase
        onClick={onRetry}
        sx={{
          ...actionSx,
          bgcolor: colors.primaryDark,
          color: colors.white,
          '&:hover': { bgcolor: colors.primaryDarkHover },
        }}
      >
        {copy.shell.tryAgain}
      </ButtonBase>
      <Box
        component="a"
        href="/"
        sx={{
          ...actionSx,
          display: 'flex',
          alignItems: 'center',
          border: `1px solid ${colors.borderStrong}`,
          color: colors.text,
        }}
      >
        {copy.shell.home}
      </Box>
    </Box>
  </Box>
);
