import React from 'react';
import { Box, ButtonBase, CircularProgress } from '@mui/material';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { hanziSx } from '../Study/parts';
import { useComponents } from './useComponents';

/**
 * How deep the tree opens by itself. A component with no meaning of its own,
 * such as 㐫, says nothing until its parts show, so its parts open with it.
 */
const MAX_DEPTH = 2;

const Branch: React.FC<{ char: string; depth: number }> = ({ char, depth }) => {
  const [load, retry] = useComponents(char);
  const note = { fontSize: 13, color: colors.textSecondary, pl: `${depth * 18}px` };

  if (load.status === 'loading') {
    return (
      <Box sx={note}>
        <CircularProgress size={14} aria-label={copy.test.componentsLoading(char)} />
      </Box>
    );
  }
  if (load.status === 'failed') {
    return (
      <Box sx={{ ...note, display: 'flex', alignItems: 'center', gap: 1 }}>
        {copy.test.componentsFailed}
        <ButtonBase
          onClick={retry}
          sx={{ fontFamily: fonts.body, fontSize: 13, fontWeight: 600, color: colors.primaryDark }}
        >
          {copy.test.retry}
        </ButtonBase>
      </Box>
    );
  }
  if (load.components.length === 0) {
    return depth === 0 ? <Box sx={note}>{copy.test.noComponents}</Box> : null;
  }

  return (
    <>
      {load.components.map((component, i) => (
        <React.Fragment key={`${component.char}-${i}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: `${depth * 18}px` }}>
            <Box
              aria-hidden="true"
              sx={{ width: 10, borderTop: `1px solid ${colors.borderStrong}`, flex: 'none' }}
            />
            <Box lang="zh" sx={hanziSx(22, { width: 24, textAlign: 'center', flex: 'none' })}>
              {component.char}
            </Box>
            <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{component.meaning}</Box>
          </Box>
          {!component.meaning && depth + 1 < MAX_DEPTH && (
            <Branch char={component.char} depth={depth + 1} />
          )}
        </React.Fragment>
      ))}
    </>
  );
};

/** The parts of one character, drawn as a small tree under its row. */
const ComponentTree: React.FC<{ char: string }> = ({ char }) => (
  <Box
    sx={{
      ml: '15px',
      pl: 1.5,
      borderLeft: `1px solid ${colors.borderStrong}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
    }}
  >
    <Branch char={char} depth={0} />
  </Box>
);

export default ComponentTree;
