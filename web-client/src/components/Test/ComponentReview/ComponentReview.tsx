import React from 'react';

import { Box, Button } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

// The Learn stage owns this tree; a missed question shows the same breakdown so
// that the two places agree on what a component is. See issue #335.
import DecompositionTree from '../NewWords/NewWord/DecompositionTree';
import CharacterGlosses from './CharacterGlosses';

interface ComponentReviewProps {
  /** The characters to break down, one tree each. Empty means no review. */
  chars: string[];
  /** The character set on screen, so the glosses match what was asked. */
  charSet: 'simp' | 'trad';
  open: boolean;
  onToggle: () => void;
  onContinue: () => void;
}

/**
 * The reveal that follows a missed character question.
 *
 * The pinyin and meaning of each character are the aid for a missed meaning,
 * so they show at once. The component breakdown is the aid for writing, so it
 * waits behind a button. The session waits here until Continue.
 */
const ComponentReview: React.FC<ComponentReviewProps> = ({
  chars,
  charSet,
  open,
  onToggle,
  onContinue,
}) => {
  if (chars.length === 0) return null;

  return (
    <Box data-testid="component-review" sx={{ mt: 1.5, mb: 2, width: '100%' }}>
      {/* The buttons carry the gap to whatever follows: the glosses below, or,
          when the answer area is still on screen, the answer area. Without it
          the next thing down reads as part of the button row. */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
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
      <CharacterGlosses
        chars={chars}
        charSet={charSet}
        renderBreakdown={
          open
            ? (char) => (
                <Box sx={{ mt: 1 }}>
                  <DecompositionTree char={char} />
                </Box>
              )
            : undefined
        }
      />
    </Box>
  );
};

export default ComponentReview;
