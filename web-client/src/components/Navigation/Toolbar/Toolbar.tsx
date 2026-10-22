import React from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { routes } from '../navLinks';
import * as actions from '../../../store/actions/index';
import { AppDispatch } from '../../../types/actions';
import { colors, fonts } from '../../../theme';
import { copy } from '../../../copy';

export const TOP_BAR_HEIGHT = { phone: 48, desktop: 56 } as const;

interface Props {
  isAuth: boolean;
  phone: boolean;
}

/**
 * The bar across the top. A signed-in phone shows only the brand, centred;
 * a visitor also gets Log in and Sign up. A signed-in desktop has no top bar:
 * the sidebar holds the brand.
 */
const Toolbar: React.FC<Props> = ({ isAuth, phone }) => {
  const dispatch = useDispatch<AppDispatch>();
  const height = phone ? TOP_BAR_HEIGHT.phone : TOP_BAR_HEIGHT.desktop;

  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        // A notched phone's inset adds to the bar, not into it.
        height: `calc(${height}px + env(safe-area-inset-top))`,
        boxSizing: 'border-box',
        pl: phone ? 2 : 4,
        pr: phone ? 1 : 3,
        pt: 'env(safe-area-inset-top)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isAuth ? 'center' : 'space-between',
        bgcolor: colors.primary,
        borderBottom: `1px solid ${colors.divider}`,
        color: colors.text,
      }}
    >
      <Box
        component={Link}
        to={routes.home}
        sx={{
          fontFamily: fonts.brand,
          fontSize: phone ? 30 : 32,
          lineHeight: 1,
          color: colors.text,
          textDecoration: 'none',
        }}
      >
        {copy.shell.brand}
      </Box>
      {!isAuth && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: phone ? 0.5 : 1 }}>
          <ButtonBase
            onClick={() => dispatch(actions.openAuthModal('login'))}
            sx={{
              height: 44,
              px: phone ? 1.5 : 2,
              fontFamily: fonts.body,
              fontSize: 15,
              fontWeight: 600,
              color: colors.text,
            }}
          >
            {copy.shell.login}
          </ButtonBase>
          <ButtonBase
            onClick={() => dispatch(actions.openAuthModal('register'))}
            sx={{
              height: phone ? 36 : 44,
              px: phone ? 2 : 2.5,
              borderRadius: 1,
              bgcolor: colors.primaryDark,
              fontFamily: fonts.body,
              fontSize: 15,
              fontWeight: 600,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            {copy.shell.signUp}
          </ButtonBase>
        </Box>
      )}
    </Box>
  );
};

export default Toolbar;
