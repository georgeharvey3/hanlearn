import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import SearchRounded from '@mui/icons-material/SearchRounded';
import TranslateRounded from '@mui/icons-material/TranslateRounded';
import QuizRounded from '@mui/icons-material/QuizRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import { SvgIconProps } from '@mui/material/SvgIcon';

interface Step {
  number: number;
  icon: React.ComponentType<SvgIconProps>;
  heading: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: SearchRounded,
    heading: 'Search & Add Words',
    description:
      'Find any word in our 124,000-entry dictionary and add it to your personal word bank.',
  },
  {
    number: 2,
    icon: TranslateRounded,
    heading: 'Understand the Characters',
    description:
      'See pinyin, meaning, and the building blocks behind every word.',
  },
  {
    number: 3,
    icon: QuizRounded,
    heading: 'Test Every Angle',
    description:
      'Match characters to pinyin, pinyin to meaning, and every combination in between.',
  },
  {
    number: 4,
    icon: EditNoteRounded,
    heading: 'Use Words in Sentences',
    description:
      'Practise reading and creating sentences to cement your understanding.',
  },
];

const HowItWorks: React.FC = () => (
  <Box sx={{ width: '95%', mx: 'auto', py: 4 }}>
    <Typography
      variant="h4"
      sx={{ textAlign: 'center', mb: 4, color: 'primary.dark', fontWeight: 600 }}
    >
      How It Works
    </Typography>
    <Grid container spacing={4}>
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <Grid key={step.number} size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ textAlign: 'center', px: 2 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: 'primary.dark',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Icon sx={{ color: 'white', fontSize: 32 }} />
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  color: 'primary.dark',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  mb: 0.5,
                }}
              >
                Step {step.number}
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: 'text.primary', fontWeight: 600, mb: 1 }}
              >
                {step.heading}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {step.description}
              </Typography>
            </Box>
          </Grid>
        );
      })}
    </Grid>
  </Box>
);

export default HowItWorks;
