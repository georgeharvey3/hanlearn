import React from 'react';
import Box from '@mui/material/Box';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import HeroPhone from './HeroPhone';
import { Ctas, FullBleed } from './layout';
import { useGutter, useStageScale } from './motion';

/**
 * The first screen: the promise, the actions, and a phone that runs the study
 * screen by itself until the visitor taps it and answers for real. Under it,
 * the facts.
 */
const ProductHero: React.FC = () => {
  const { phone, topBar } = useGutter();
  const scale = useStageScale();
  return (
    <FullBleed cancelTop bg={colors.paper}>
      <Box
        sx={{
          minHeight: `calc(100svh - ${topBar}px)`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 2,
          pt: { xs: 4, md: 2 },
          pb: { xs: 5, md: 3 },
        }}
      >
        <Box style={{ zoom: scale }}>
          <Box
            sx={{
              width: '100%',
              maxWidth: 1080,
              mx: 'auto',
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: { xs: 5, md: 6 },
            }}
          >
            <Box sx={{ maxWidth: 520, textAlign: { xs: 'center', md: 'left' } }}>
              <Box
                component="h1"
                sx={{
                  m: 0,
                  fontSize: { xs: 36, sm: 60 },
                  lineHeight: 1.04,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: colors.text,
                }}
              >
                {copy.landing.headline}
              </Box>
              <Box
                sx={{
                  mt: { xs: 2, sm: 2.5 },
                  mb: { xs: 3, sm: 4 },
                  fontSize: { xs: 17, sm: 20 },
                  lineHeight: 1.45,
                  color: colors.textSecondary,
                }}
              >
                {copy.landing.sub}
              </Box>
              <Ctas align={phone ? 'center' : 'flex-start'} />
            </Box>
            <HeroPhone width={phone ? 280 : 310} />
          </Box>

          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              p: 0,
              m: 0,
              mt: { xs: 6, md: 3 },
              mx: 'auto',
              maxWidth: 1080,
              width: '100%',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: { xs: 2.5, md: 0 },
              borderTop: { md: `1px solid ${colors.divider}` },
              pt: { md: 2.5 },
            }}
          >
            {copy.landing.facts.map((f) => (
              <Box component="li" key={f.label} sx={{ textAlign: 'center' }}>
                <Box sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 700, color: colors.text }}>
                  {f.value}
                </Box>
                <Box sx={{ fontSize: { xs: 13, sm: 14 }, color: colors.textSecondary }}>
                  {f.label}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </FullBleed>
  );
};

export default ProductHero;
