import React from 'react';
import Box from '@mui/material/Box';

import { colors, fonts } from '../../theme';
import { copy } from '../../copy';
import { creditSources, sentenceFiles } from '../../data/credits';

const linkSx = { color: colors.primaryDark, fontWeight: 600 };

const cardSx = {
  p: 2,
  bgcolor: colors.card,
  border: `1px solid ${colors.divider}`,
  borderRadius: 1,
};

/** The sources of the app's data and their licences (#469). Settings opens it. */
const Credits: React.FC = () => {
  const text = copy.credits;
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: { xs: 560, md: 640 },
        mx: 'auto',
        pb: 4,
        textAlign: 'left',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      <Box component="h1" sx={{ m: 0, mb: 2.5, fontSize: 32, fontWeight: 600 }}>
        {text.title}
      </Box>
      <Box
        component="ul"
        sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        {creditSources.map((source) => (
          <Box component="li" key={source.name} sx={cardSx}>
            <Box component="a" href={source.url} sx={{ ...linkSx, fontSize: 17 }}>
              {source.name}
            </Box>
            <Box sx={{ mt: 0.5, fontSize: 15 }}>
              {text.licence}
              <Box component="a" href={source.licence.url} sx={linkSx}>
                {source.licence.name}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ ...cardSx, mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 2.5, fontSize: 15 }}>
        <Box component="a" href={sentenceFiles.attribution} sx={linkSx}>
          {text.sentenceCredits}
        </Box>
        <Box component="a" href={sentenceFiles.licence} sx={linkSx}>
          {text.sentenceLicence}
        </Box>
      </Box>
    </Box>
  );
};

export default Credits;
