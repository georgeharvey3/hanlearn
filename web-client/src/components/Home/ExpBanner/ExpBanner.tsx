import React, { ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';

interface ExpBannerProps {
  priority?: 'left' | 'right';
  heading?: string;
  img?: string;
  children?: ReactNode;
}

const ExpBanner: React.FC<ExpBannerProps> = (props) => {
  const textSection = (
    <Grid size={{ xs: 12, sm: 6 }} sx={{ p: 1 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {props.heading}
      </Typography>
      <Typography variant="body1" sx={{ fontSize: '1.2em' }}>
        {props.children}
      </Typography>
    </Grid>
  );

  const imageSection = (
    <Grid
      size={{ xs: 12, sm: 6 }}
      sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'center', p: 1 }}
    >
      <Box
        component="img"
        src={props.img}
        alt={props.heading || 'Feature screenshot'}
        sx={{ width: '90%', maxHeight: 400, maxWidth: 400 }}
      />
    </Grid>
  );

  return (
    <Paper
      sx={{
        width: '95%',
        mx: 'auto',
        display: 'flex',
        p: { xs: 2, sm: '20px 10%' },
        color: 'text.primary',
        textAlign: 'justify',
        fontSize: { xs: '1em', sm: '1.1em' },
      }}
      elevation={3}
    >
      <Grid container alignItems="center" spacing={2}>
        {props.priority === 'left' ? (
          <>
            {textSection}
            {imageSection}
          </>
        ) : (
          <>
            {imageSection}
            {textSection}
          </>
        )}
      </Grid>
    </Paper>
  );
};

export default ExpBanner;
