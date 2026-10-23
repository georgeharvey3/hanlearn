// PROTOTYPE (#403) headline O, "Quiet": no headline. The tab bar's Study
// button is the primary action on every screen, so the Dashboard does not
// repeat it. The top is the date and one line of status; only an unfinished
// session gets a banner, because it is the one thing the Study button cannot
// say. The widgets are the page. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';

import { colors, fonts } from '../../../theme';
import { DashboardVariantProps, ListMenu } from './dashboardShared';
import { WidgetStack } from './headlineShared';

export const name = 'Quiet';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const VariantO: React.FC<DashboardVariantProps> = (props) => {
  const { stats, words, loading, error, resumeLabel, onResume, onStartOver, onAddWords, onRetry } =
    props;
  const empty = !loading && !error && words.length === 0;
  const today = new Date();
  const due = stats?.dueWords ?? 0;

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', pb: 24, textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 28, lineHeight: 1.2 }}>
            {today.getMonth() + 1}月{today.getDate()}日 · 星期{WEEKDAYS[today.getDay()]}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {loading ? (
              <Skeleton width={140} />
            ) : error ? (
              'Could not load'
            ) : empty ? (
              'No words yet'
            ) : due ? (
              `${due} due · ${stats?.estimatedStudyTime ?? ''}`
            ) : (
              'Nothing due today'
            )}
          </Typography>
        </Box>
        <ListMenu {...props} />
      </Box>

      {error && (
        <Button onClick={onRetry} sx={{ color: colors.primaryDark, px: 0, mt: 1 }}>
          Try again
        </Button>
      )}
      {empty && (
        <Button onClick={onAddWords} sx={{ color: colors.primaryDark, px: 0, mt: 1 }}>
          Add words
        </Button>
      )}

      {resumeLabel && !empty && !loading && !error && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 2,
            pl: 2,
            pr: 1,
            py: 1,
            borderRadius: 2,
            border: `1px solid ${colors.primaryDark}`,
            bgcolor: colors.successSurface,
          }}
        >
          <Typography sx={{ flex: 1, fontWeight: 600 }}>Unfinished · {resumeLabel}</Typography>
          <Button onClick={onStartOver} sx={{ color: colors.textSecondary }}>
            Start over
          </Button>
          <Button
            onClick={onResume}
            variant="contained"
            sx={{
              bgcolor: colors.primaryDark,
              color: colors.white,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            Resume
          </Button>
        </Box>
      )}

      <WidgetStack {...props} />
    </Box>
  );
};

export default VariantO;
