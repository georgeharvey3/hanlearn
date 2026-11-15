import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import StudyButton, { useDueCount } from '../StudyButton/StudyButton';
import MoreSheet from './MoreSheet';
import TabDot from '../TabDot';
import { useSentenceTabs } from '../../../hooks/useSentenceTabs';
import { HomeIcon, AddIcon, ComprehendIcon, MoreIcon } from '../icons';
import { routes, isActive } from '../navLinks';
import { sentenceLinks } from '../sentenceLinks';
import { colors, fonts } from '../../../theme';
import { copy } from '../../../copy';

export const TAB_BAR_HEIGHT = 64;

const SENTENCE_LINKS = sentenceLinks();

interface Props {
  onOpenShortcuts: () => void;
}

const dotSx = { position: 'absolute', top: 10, left: 'calc(50% + 10px)' };

const menuRowSx = {
  minHeight: 48,
  gap: 2,
  fontFamily: fonts.body,
  fontSize: 17,
  color: colors.text,
};

const tabSx = (active: boolean) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2px',
  fontFamily: fonts.body,
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  color: active ? colors.primaryDark : colors.textSecondary,
  textDecoration: 'none',
});

/**
 * The phone's bottom tab bar: Home, Add, a raised Study button, Sentences and
 * More. Sentences opens a menu of Comprehend and Compose; More opens a sheet
 * with the rest.
 */
const TabBar: React.FC<Props> = ({ onOpenShortcuts }) => {
  const { pathname } = useLocation();
  const due = useDueCount();
  const [moreOpen, setMoreOpen] = useState(false);
  // The Sentences tab while its menu is open, which anchors the menu.
  const [sentencesAnchor, setSentencesAnchor] = useState<HTMLElement | null>(null);
  const sentencesOpen = Boolean(sentencesAnchor);
  const closeSentences = () => setSentencesAnchor(null);
  const onSentences = SENTENCE_LINKS.some((link) => isActive(pathname, link.to));
  const onMore = isActive(pathname, routes.settings);
  const sentenceTabs = useSentenceTabs();
  const fresh = Boolean(sentenceTabs?.comprehend.fresh || sentenceTabs?.compose.fresh);

  const tab = (to: string, label: string, icon: React.ReactNode) => (
    <ButtonBase
      component={Link}
      to={to}
      aria-current={isActive(pathname, to) ? 'page' : undefined}
      sx={tabSx(isActive(pathname, to))}
    >
      {icon}
      <span>{label}</span>
    </ButtonBase>
  );

  return (
    <>
      <Box
        component="nav"
        aria-label={copy.shell.mainNav}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          // A notched phone's inset adds to the bar, not into it.
          height: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
          pb: 'env(safe-area-inset-bottom)',
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: colors.primary,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        {tab(routes.home, copy.shell.home, <HomeIcon />)}
        {tab(routes.add, copy.shell.add, <AddIcon />)}
        <ButtonBase
          component={Link}
          to={routes.study}
          aria-label={due > 0 ? copy.shell.studyDue(due) : copy.shell.study}
          sx={{ ...tabSx(true), justifyContent: 'flex-start', mt: '-24px' }}
        >
          <Box
            component="span"
            sx={{ display: 'flex', borderRadius: '50%', boxShadow: `0 0 0 4px ${colors.primary}` }}
          >
            <StudyButton due={due} size={56} />
          </Box>
          <span>{copy.shell.study}</span>
        </ButtonBase>
        <ButtonBase
          // The menu's backdrop covers this tab while it is open, so a second
          // tap lands on the backdrop and closes the menu.
          onClick={(event) => setSentencesAnchor(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={sentencesOpen}
          aria-current={onSentences ? 'page' : undefined}
          aria-label={fresh ? copy.sentenceTabs.withNew(copy.shell.sentences) : undefined}
          sx={{ ...tabSx(sentencesOpen || onSentences), position: 'relative' }}
        >
          <ComprehendIcon />
          <span>{copy.shell.sentences}</span>
          {fresh && <TabDot sx={dotSx} />}
        </ButtonBase>
        <ButtonBase
          onClick={() => setMoreOpen(true)}
          aria-current={onMore ? 'page' : undefined}
          sx={tabSx(moreOpen || onMore)}
        >
          <MoreIcon />
          <span>{copy.shell.more}</span>
        </ButtonBase>
      </Box>
      <Menu
        anchorEl={sentencesAnchor}
        open={sentencesOpen}
        onClose={closeSentences}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {SENTENCE_LINKS.map((link) => {
          const rowFresh = sentenceTabs?.[link.tab].fresh ?? false;
          return (
            <MenuItem
              key={link.to}
              component={Link}
              to={link.to}
              onClick={closeSentences}
              aria-label={rowFresh ? copy.sentenceTabs.withNew(link.label) : undefined}
              sx={menuRowSx}
            >
              {link.icon}
              {link.label}
              {rowFresh && <TabDot />}
            </MenuItem>
          );
        })}
      </Menu>
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenShortcuts={onOpenShortcuts}
      />
    </>
  );
};

export default TabBar;
