import React from 'react';
import { Box } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';

import CharacterGlosses from './CharacterGlosses';
import CharacterBreakdown from './CharacterBreakdown';
import { Overline, TextButton } from '../Study/parts';
import { copy } from '../../../copy';

interface ComponentReviewProps {
  /** The characters to break down, one row each. Empty means no review. */
  chars: string[];
  /** The character set on screen, so the glosses match what was asked. */
  charSet: 'simp' | 'trad';
  open: boolean;
  onToggle: () => void;
  /** The heading over the rows. Defaults to "Characters". */
  title?: string;
}

/**
 * The reveal that follows a missed character question.
 *
 * The pinyin and meaning of each character are the aid for a missed meaning,
 * so they show at once. The component breakdown is the aid for writing, so
 * after a missed drawing it opens at once; otherwise it waits behind a button.
 * The session waits for Continue, in TestActions.
 */
const ComponentReview: React.FC<ComponentReviewProps> = ({
  chars,
  charSet,
  open,
  onToggle,
  title = copy.test.characters,
}) => {
  if (chars.length === 0) return null;

  return (
    <Box data-testid="component-review" sx={{ display: 'flex', flexDirection: 'column' }}>
      <Overline sx={{ mt: 0.5, mb: 1 }}>{title}</Overline>
      <CharacterGlosses
        chars={chars}
        charSet={charSet}
        renderBreakdown={open ? (char) => <CharacterBreakdown char={char} /> : undefined}
      />
      <TextButton
        onClick={onToggle}
        aria-expanded={open}
        icon={<AccountTreeOutlinedIcon sx={{ fontSize: 18 }} />}
      >
        {open ? copy.test.hideComponents : copy.test.showComponents}
      </TextButton>
    </Box>
  );
};

export default ComponentReview;
