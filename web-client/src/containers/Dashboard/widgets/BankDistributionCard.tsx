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
          <Typography variant="caption" sx={{ width: 60, flexShrink: 0 }}>
            {bankLabels[bank]}
          </Typography>
          <Box sx={{ flexGrow: 1, mr: 1 }}>
            <Box
              sx={{
                height: 12,
                borderRadius: 1,
                backgroundColor: colors.primaryDark,
                opacity: 0.3 + (bank / 5) * 0.7,
                width: `${(distribution[bank] / max) * 100}%`,
                minWidth: distribution[bank] > 0 ? 4 : 0,
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 20, textAlign: 'right' }}>
            {distribution[bank]}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
};

export default React.memo(BankDistributionCard);
