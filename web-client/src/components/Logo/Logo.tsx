import React from 'react';
import Box from '@mui/material/Box';

import hanLearnLogo from '../../assets/images/hlclearsq.png';
import hanLearnLogoRed from '../../assets/images/hlclearredsq.png';

interface LogoProps {
  colour?: 'red';
}

const Logo: React.FC<LogoProps> = (props) => {
  let logoVer = hanLearnLogo;

  if (props.colour === 'red') {
    logoVer = hanLearnLogoRed;
  }
  return (
    <Box sx={{ p: 1, height: '100%', boxSizing: 'border-box', '& img': { height: '100%' } }}>
      <img src={logoVer} alt="HanLearn" />
    </Box>
  );
};

export default Logo;
