import React from 'react';

import { Box, Button, Typography } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

// The Learn stage owns this tree; a missed question shows the same breakdown so
// that the two places agree on what a component is. See issue #335.
import DecompositionTree from '../NewWords/NewWord/DecompositionTree';

interface ComponentReviewProps {
  /** The characters to break down, one tree each. Empty means no review. */
  chars: string[];
  open: boolean;
  onToggle: () => void;
  onContinue: () => void;
}

/**
 * The reveal that follows a missed character question.
 *
 * Knowledge of radicals and components predicts character recognition, so a
 * direction the learner has just lost is the moment to show them again. The
 * session waits here: the breakdown is a request away, and Continue moves on.
 */
const ComponentReview: React.FC<ComponentReviewProps> = ({ chars, open, onToggle, onContinue }) => {
  if (chars.length === 0) return null;

  return (
    <Box data-testid="component-review" sx={{ mt: 1.5, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
        <Button
          variant={open ? 'contained' : 'outlined'}
          size="small"
          startIcon={<AccountTreeOutlinedIcon />}
          onClick={onToggle}
          aria-expanded={open}
          sx={
            open
              ? {
                  px: 2.5,
                  bgcolor: 'primary.dark',
                  color: '#fff',
                  '&:hover': { bgcolor: '#145233' },
                }
              : { px: 2.5, color: 'text.secondary', borderColor: 'divider' }
          }
        >
          Components
        </Button>
        <Button variant="contained" size="small" onClick={onContinue} sx={{ px: 3 }}>
          Continue
        </Button>
      </Box>
      {open && (
        <Box sx={{ mt: 1, textAlign: 'left' }}>
          {chars.map((char, index) => (
            <Box key={`${char}-${index}`} sx={{ mb: 1 }}>
              <Typography
                lang="zh"
                sx={{ fontSize: '1.6em', textAlign: 'center', color: 'text.primary' }}
              >
                {char}
              </Typography>
              <DecompositionTree char={char} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ComponentReview;
