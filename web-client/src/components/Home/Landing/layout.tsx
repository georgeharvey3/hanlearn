// The frame the landing sections sit in, and the two actions they all offer.
import React from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import GlobalStyles from '@mui/material/GlobalStyles';

import * as actions from '../../../store/actions/index';
import { AppDispatch } from '../../../types/actions';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { useGutter } from './motion';

// A pale celadon green: the one note of colour, quiet enough to sit between
// the paper sections.
export const CELADON = '#dce6da';

/**
 * Breaks out of Layout's padded, max-width <main> to the full viewport width.
 * `cancelTop` pulls the first section up to meet the top bar.
 */
export const FullBleed: React.FC<{
  children: React.ReactNode;
  cancelTop?: boolean;
  bg?: string;
  sx?: object;
}> = ({ children, cancelTop, bg, sx }) => {
  const { gutter } = useGutter();
  return (
    <Box
      sx={{
        width: '100vw',
        ml: 'calc(50% - 50vw)',
        mt: cancelTop ? `-${gutter}px` : 0,
        bgcolor: bg,
        position: 'relative',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

/** Keeps a 100vw section from adding a sideways scroll on desktop. */
export const LandingGlobals: React.FC<{ extra?: object }> = ({ extra }) => (
  <GlobalStyles styles={{ html: { overflowX: 'clip' }, body: { overflowX: 'clip' }, ...extra }} />
);

export const useLandingActions = () => {
  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();
  return {
    signUp: () => dispatch(actions.openAuthModal('register')),
    tryOut: () => history.push('/tryout'),
  };
};

export const Ctas: React.FC<{ align?: 'center' | 'flex-start'; inverse?: boolean }> = ({
  align = 'center',
  inverse,
}) => {
  const { signUp, tryOut } = useLandingActions();
  const base = {
    height: 48,
    px: 3,
    borderRadius: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: 600,
  };
  return (
    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: align, flexWrap: 'wrap' }}>
      <ButtonBase
        onClick={signUp}
        sx={{
          ...base,
          bgcolor: inverse ? colors.paper : colors.primaryDark,
          color: inverse ? colors.primaryDark : colors.white,
          '&:hover': { bgcolor: inverse ? colors.white : colors.primaryDarkHover },
        }}
      >
        {copy.landing.startLearning}
      </ButtonBase>
      <ButtonBase
        onClick={tryOut}
        sx={{
          ...base,
          border: `1px solid ${inverse ? 'rgba(255,255,255,0.5)' : colors.borderStrong}`,
          color: inverse ? colors.white : colors.text,
          '&:hover': { borderColor: inverse ? colors.white : colors.textSecondary },
        }}
      >
        {copy.landing.trySession}
      </ButtonBase>
    </Box>
  );
};
