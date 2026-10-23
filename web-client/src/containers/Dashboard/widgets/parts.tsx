import React, { useId } from 'react';
import Box, { BoxProps } from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { colors, shadows } from '../../../theme';

/** The white surface every Dashboard widget sits on. */
export const Card: React.FC<BoxProps> = ({ sx, ...props }) => (
  <Box
    {...props}
    sx={[
      { bgcolor: colors.card, boxShadow: shadows.card, borderRadius: 2, textAlign: 'left' },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  />
);

/** A widget under its small uppercase label. */
export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const id = useId();
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
    >
      <Typography
        id={id}
        component="h2"
        sx={{
          m: 0,
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.textSecondary,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
};

/** A large number over its label. */
export const Figure: React.FC<{ value: React.ReactNode; label: string }> = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ fontSize: 14, color: colors.textSecondary }}>{label}</Typography>
  </Box>
);
