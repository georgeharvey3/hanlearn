import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { hanziSx } from '../Test/Study/parts';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';

/** A pale block in place of text that loads, or that the bank covers. */
export const Block: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <Box
    component="span"
    sx={{ width, height, flex: 'none', borderRadius: '2px', bgcolor: colors.skeleton }}
  />
);

const block = (width: number, height: number) => <Block width={width} height={height} />;

/**
 * Grey rows in the shape of the bank while the words load, and grey chips on
 * the first load, before the lists are known.
 */
export const BankLoading: React.FC<{ chips: boolean }> = ({ chips }) => (
  <Box
    role="status"
    aria-label={copy.wordBank.loading}
    sx={{ display: 'flex', flexDirection: 'column' }}
  >
    {chips && (
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {block(96, 44)}
        {block(104, 44)}
        {block(72, 44)}
      </Box>
    )}
    {[180, 120, 150, 96, 170, 130, 110].map((width) => (
      <Box
        key={width}
        sx={{
          height: 64,
          borderBottom: `1px solid ${colors.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        {block(56, 28)}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {block(72, 12)}
          {block(width, 10)}
        </Box>
      </Box>
    ))}
  </Box>
);

/** The 错 stamp, "Your words didn’t load" and Retry. */
export const BankLoadError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Box
    role="alert"
    sx={{
      mt: 3,
      py: 4,
      px: 2.5,
      bgcolor: colors.card,
      border: `1px solid ${colors.divider}`,
      borderRadius: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      textAlign: 'center',
    }}
  >
    <Box
      lang="zh"
      aria-hidden="true"
      sx={{
        ...hanziSx(40),
        width: 64,
        height: 64,
        boxSizing: 'border-box',
        border: `3px solid ${colors.primaryLight}`,
        borderRadius: '6px',
        color: colors.primaryLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {copy.wordBank.errorStamp}
    </Box>
    <Box component="h1" sx={{ m: 0, mt: 0.5, fontSize: 20, fontWeight: 600 }}>
      {copy.wordBank.loadFailed}
    </Box>
    <ButtonBase
      onClick={onRetry}
      sx={{
        height: 44,
        px: 2.5,
        borderRadius: 1,
        border: `1px solid ${colors.borderStrong}`,
        fontFamily: fonts.body,
        fontSize: 15,
        fontWeight: 600,
        color: colors.text,
      }}
    >
      {copy.wordBank.retry}
    </ButtonBase>
  </Box>
);

/** An empty bank or list: the faint 字, a title, and words to try. */
export const BankEmpty: React.FC<{ title: string; onTry: (word: string) => void }> = ({
  title,
  onTry,
}) => (
  <Box
    sx={{
      pt: 7,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
      textAlign: 'center',
    }}
  >
    <Box lang="zh" aria-hidden="true" sx={hanziSx(72, { color: colors.outline })}>
      {copy.wordBank.emptyMark}
    </Box>
    <Box component="h1" sx={{ m: 0, fontSize: 20, fontWeight: 600 }}>
      {title}
    </Box>
    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
      {copy.wordBank.suggestions.map((word) => (
        <ButtonBase
          key={word}
          lang="zh"
          onClick={() => onTry(word)}
          sx={{
            ...hanziSx(20),
            height: 44,
            px: '14px',
            borderRadius: 1,
            border: `1px solid ${colors.borderStrong}`,
            bgcolor: colors.card,
            color: colors.text,
          }}
        >
          {word}
        </ButtonBase>
      ))}
    </Box>
  </Box>
);
