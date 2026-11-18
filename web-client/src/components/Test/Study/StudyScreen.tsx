import React, { createContext, useContext } from 'react';
import { Box } from '@mui/material';

import { colors, fonts } from '../../../theme';
import { DESKTOP_GUTTER } from '../../Layout/gutter';

/** The tallest a study screen is on a wide screen: the height of a phone. */
const STUDY_MAX_HEIGHT = 844;

/**
 * The height the layout takes round the main area on a wide screen. A
 * signed-in learner there has the sidebar and no top bar, so only the main
 * area's padding above and below remains.
 */
const WIDE_CHROME = 2 * DESKTOP_GUTTER;

/** Whether the screen round a `StudyBody` is `fixed`, so the body scrolls on a phone too. */
const FixedContext = createContext(false);

/**
 * The column a study screen fills: a phone's width, with the session bar at
 * the top and the main action at the foot.
 *
 * On a phone a session hides the app's navigation, so the column is at least
 * the window's height and the page scrolls as it always has.
 *
 * On a wide screen the column is as tall as a phone, or the window less the
 * main area's padding if that is shorter, so the page never scrolls. The
 * middle of the screen goes in a `StudyBody`, which scrolls on its own, so the
 * session bar and the actions stay in view.
 *
 * A `fixed` screen is exactly the window's height on a phone too. The Test,
 * the summary and the new-word introduction use it, and each scrolls its own
 * middle at every size, so the main action stays pinned at the foot. A
 * `StudyBody` in a fixed screen scrolls on a phone as well.
 */
const StudyScreen: React.FC<{ fixed?: boolean; children: React.ReactNode }> = ({
  fixed,
  children,
}) => (
  <FixedContext.Provider value={!!fixed}>
    <Box
      data-testid="study-screen"
      sx={{
        width: '100%',
        maxWidth: 440,
        mx: 'auto',
        height: {
          xs: fixed ? '100dvh' : 'auto',
          sm: `min(${STUDY_MAX_HEIGHT}px, calc(100dvh - ${WIDE_CHROME}px))`,
        },
        minHeight: { xs: fixed ? 0 : '100dvh', sm: 0 },
        boxSizing: 'border-box',
        px: 2,
        pb: 3,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      {children}
    </Box>
  </FixedContext.Provider>
);

/**
 * The middle of a study screen, between the session bar and the actions. It
 * takes the free height, so the actions sit at the foot. On a wide screen it
 * scrolls when its content is taller than the room; on a phone it grows and
 * the page scrolls, unless the screen is `fixed`, when it scrolls there too. Its bottom padding keeps the content off the actions.
 *
 * The content sits in an inner column of its own height. In the scrolling box
 * itself, a fixed-height child (a button, an input, a card) would shrink to
 * its text before the box scrolled.
 */
export const StudyBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fixed = useContext(FixedContext);
  return (
    <Box
      data-testid="study-body"
      sx={{
        flex: '1 1 auto',
        minHeight: fixed ? 0 : { sm: 0 },
        overflowY: fixed ? 'auto' : { sm: 'auto' },
        // The scroll bar sits at the column's edge, not on the content.
        mx: -2,
        px: 2,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', pb: 3 }}>{children}</Box>
    </Box>
  );
};

export default StudyScreen;
