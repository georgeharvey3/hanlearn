import React, { useEffect, useState } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import MuiToolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import NavigationItems from '../NavigationItems/NavigationItems';
import DrawerToggle from '../SideDrawer/DrawerToggle/DrawerToggle';
import { colors } from '../../../theme';

interface ToolbarProps extends RouteComponentProps {
  drawerToggleClicked?: () => void;
  isAuth?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = (props) => {
  const isHomePage = props.location.pathname === '/' && !props.isAuth;
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (!isHomePage) return;
    const handleScroll = () => {
      const banner = document.getElementById('main-banner');
      if (banner) {
        const bannerBottom = banner.getBoundingClientRect().bottom;
        const pastBanner = Math.max(0, window.innerHeight - bannerBottom);
        setScrollProgress(Math.min(1, pastBanner / 200));
      } else {
        setScrollProgress(Math.min(1, window.scrollY / 200));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHomePage]);

  const logoMaxSize = typeof window !== 'undefined' && window.innerWidth < 600 ? 44 : 100;
  const logoMinSize = 44;
  const logoSize = isHomePage ? logoMaxSize - scrollProgress * (logoMaxSize - logoMinSize) : 44;

  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: isHomePage ? (scrollProgress > 0 ? colors.primary : 'transparent') : colors.primary,
        boxShadow: isHomePage && scrollProgress === 0 ? 0 : 1,
        borderBottom: isHomePage && scrollProgress === 0 ? 'none' : `1px solid ${colors.divider}`,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
        overflow: 'visible',
      }}
    >
      <MuiToolbar sx={{ minHeight: 56, overflow: 'visible', alignItems: isHomePage && logoSize > 56 ? 'flex-start' : 'center', pt: isHomePage && logoSize > 56 ? '14px' : 0 }}>
        <DrawerToggle clicked={props.drawerToggleClicked} textColor={colors.text} />
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexGrow: 1 }} />
        <Typography
          component="a"
          role="link"
          tabIndex={0}
          onClick={() => props.history.push('/')}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') props.history.push('/'); }}
          sx={{
            fontFamily: "'Spell of Asia', sans-serif",
            color: colors.text,
            cursor: 'pointer',
            fontSize: `${logoSize}px`,
            lineHeight: 1,
            transition: 'font-size 0.1s ease-out',
            overflow: 'visible',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          HanLearn
        </Typography>
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexGrow: 1 }} />
        {!props.isAuth && (
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, height: '100%' }}>
            <NavigationItems authenticated={props.isAuth} textColor={colors.text} />
          </Box>
        )}
      </MuiToolbar>
    </AppBar>
  );
};

export default withRouter(Toolbar);
