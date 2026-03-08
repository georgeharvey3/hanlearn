import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { colors } from '../../../theme';

interface BankDistributionCardProps {
  distribution: Record<number, number>;
}

const bankLabels: Record<number, string> = {
  1: 'New',
  2: 'Learning',
  3: 'Familiar',
  4: 'Known',
  5: 'Mastered',
};

const BankDistributionCard: React.FC<BankDistributionCardProps> = ({ distribution }) => {
  const max = Math.max(...Object.values(distribution), 1);

  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2, height: '100%' }}>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
        Word Levels
      </Typography>
      {[1, 2, 3, 4, 5].map((bank) => (
        <Box key={bank} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ width: 60, flexShrink: 0 }} id={`bank-label-${bank}`}>
            {bankLabels[bank]}
          </Typography>
          <Box sx={{ flexGrow: 1, mr: 1 }}>
            <Box
              role="meter"
              aria-labelledby={`bank-label-${bank}`}
              aria-valuenow={distribution[bank] ?? 0}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuetext={`${distribution[bank] ?? 0} words`}
              sx={{
                height: 12,
                borderRadius: 1,
                backgroundColor: colors.primaryDark,
                opacity: 0.3 + (bank / 5) * 0.7,
                width: `${((distribution[bank] ?? 0) / max) * 100}%`,
                minWidth: distribution[bank] > 0 ? 4 : 0,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 20, textAlign: 'right' }} aria-hidden="true">
            {distribution[bank] ?? 0}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default React.memo(BankDistributionCard);
