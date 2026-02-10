import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import mainImage from '../../../assets/images/main-image.jpeg';

const MainBanner: React.FC = () => (
  <Box sx={{ width: '100vw', position: 'relative', left: '50%', transform: 'translateX(-50%)', py: { xs: 3, md: 4.5 } }}>
    <Box
      sx={{
        backgroundImage: `url(${mainImage})`,
        backgroundSize: 'cover',
        width: '100%',
        height: { xs: 300, sm: 550, md: 650 },
        display: 'flex',
        alignItems: 'center',
        border: 'none',
      }}
    >
      <Box
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          mx: 'auto',
          p: { xs: 2.5, sm: 4 },
          borderRadius: 1,
          color: '#e6e0ae',
          width: { xs: '90%', lg: '50%', xl: '50%' },
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5em', sm: '2.2em' }, mb: 1 }}>
          A vocabulary learning application made especially for Mandarin
        </Typography>
        <Typography variant="body1" sx={{ fontSize: { xs: '1.1em', sm: '1.5em' } }}>
          With Chinese vocabulary, there is more to learn than in other languages
        </Typography>
        <br />
        <Typography variant="body1" sx={{ fontSize: { xs: '1.1em', sm: '1.5em' } }}>
          Make long-lasting connections between the written forms, pronunciations and meanings of Chinese words with HanLearn
        </Typography>
      </Box>
    </Box>
  </Box>
);

export default MainBanner;
