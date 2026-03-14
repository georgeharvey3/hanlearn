import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import RecordVoiceOverRounded from '@mui/icons-material/RecordVoiceOverRounded';
import DrawRounded from '@mui/icons-material/DrawRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface Feature {
  icon: React.ComponentType<SvgIconProps>;
  heading: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: RecordVoiceOverRounded,
    heading: 'Speech & Audio',
    description:
      'Listen to native pronunciation and test your speaking with built-in speech recognition.',
  },
  {
    icon: DrawRounded,
    heading: 'Handwriting Input',
    description: 'Practise writing characters by hand — not just recognising them on screen.',
  },
  {
    icon: TuneRounded,
    heading: 'Customisable Tests',
    description:
      'Tailor your study sessions — choose what to test, how to be tested, and focus on the skills that matter to you.',
  },
];

const FeatureHighlights: React.FC = () => (
  <Box sx={{ bgcolor: 'primary.main', py: 6, borderRadius: 2 }}>
    <Box sx={{ width: '95%', mx: 'auto' }}>
      <Typography
        variant="h4"
        sx={{ textAlign: 'center', mb: 4, color: 'primary.dark', fontWeight: 600 }}
      >
        Powerful Learning Tools
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Grid key={feature.heading} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  textAlign: 'center',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Icon sx={{ fontSize: 48, color: 'primary.dark', mb: 2 }} />
                <Typography
                  variant="h6"
                  component="h5"
                  sx={{ color: 'text.primary', fontWeight: 600, mb: 1 }}
                >
                  {feature.heading}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  </Box>
);

export default FeatureHighlights;
