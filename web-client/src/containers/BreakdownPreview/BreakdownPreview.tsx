import React, { useState } from 'react';
import { Box, TextField } from '@mui/material';

import ComponentReview from '../../components/Test/ComponentReview/ComponentReview';
import { copy } from '../../copy';

/** The characters the page opens with: 礙 splits two steps down, 脑 has a part with no label. */
const START = '礙脑疑';

/**
 * A page of the dev server only, at /dev/breakdown: the reveal after a miss
 * for any characters, with no study session (#530). The production build
 * leaves it out. It needs the files of `npm run build:dict` in
 * web-client/public/breakdowns/, and the glosses need the emulators.
 */
const BreakdownPreview: React.FC = () => {
  const [text, setText] = useState(START);
  const [open, setOpen] = useState(true);
  // The breakdown files cover the Basic Multilingual Plane, so a split on
  // UTF-16 units is enough.
  const chars = Array.from(new Set(text.split('').filter((char) => /[㐀-鿿]/.test(char))));

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2, textAlign: 'left' }}>
      <TextField
        fullWidth
        label={copy.test.characters}
        value={text}
        onChange={(event) => setText(event.target.value)}
        sx={{ mb: 2 }}
      />
      <ComponentReview
        chars={chars}
        charSet="trad"
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
    </Box>
  );
};

export default BreakdownPreview;
