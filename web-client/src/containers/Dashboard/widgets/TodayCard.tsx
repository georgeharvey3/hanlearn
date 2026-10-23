import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { WordList } from '../../../types/models';
import { SizePlan } from '../../../services/dashboardService';
import { SESSION_SIZES, SessionSize } from '../../../utils/dashboard';
import { Card } from './parts';

const text = copy.dashboard;

const primaryButton = {
  bgcolor: colors.primaryDark,
  color: colors.white,
  borderRadius: 1,
  fontWeight: 600,
  textTransform: 'none',
  '&:hover': { bgcolor: colors.primaryDarkHover },
} as const;

export interface TodayCardProps {
  loading: boolean;
  error: boolean;
  /** No words in the list: the card offers to add some. */
  empty: boolean;
  sessionSizes: Record<SessionSize, SizePlan> | null;
  /** "12 questions left", or null when there is no session to resume. */
  resumeLabel: string | null;
  lists: WordList[];
  activeListId: string;
  onSwitchList: (listId: string) => void;
  onStudy: (size: SessionSize) => void;
  onResume: () => void;
  onStartOver: () => void;
  onAddWords: () => void;
  onRetry: () => void;
}

/**
 * The headline of the Dashboard: the session to start. The Study button of the
 * tab bar starts the usual session, so this card does what that button cannot,
 * and lets the learner choose how long the session is.
 */
const TodayCard: React.FC<TodayCardProps> = ({
  loading,
  error,
  empty,
  sessionSizes,
  resumeLabel,
  lists,
  activeListId,
  onSwitchList,
  onStudy,
  onResume,
  onStartOver,
  onAddWords,
  onRetry,
}) => {
  const [size, setSize] = useState<SessionSize>('usual');
  const chosen = sessionSizes?.[size];
  const nothingDue = sessionSizes !== null && sessionSizes.all.questions === 0;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <Box
        role="status"
        aria-label={copy.shell.loading}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
          {SESSION_SIZES.map((s) => (
            <Skeleton key={s} variant="rounded" height={84} sx={{ bgcolor: colors.skeleton }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={48} sx={{ bgcolor: colors.skeleton }} />
      </Box>
    );
  } else if (error) {
    body = (
      <Box role="alert" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ flex: 1, color: colors.error }}>{text.couldNotLoad}</Typography>
        <Button onClick={onRetry} sx={{ color: colors.primaryDark, textTransform: 'none' }}>
          {text.tryAgain}
        </Button>
      </Box>
    );
  } else if (empty) {
    body = (
      <Button onClick={onAddWords} fullWidth sx={{ ...primaryButton, height: 48, fontSize: 17 }}>
        {text.addWords}
      </Button>
    );
  } else if (resumeLabel) {
    // An unfinished session comes before any new choice.
    body = (
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: colors.successSurface,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ flex: '1 1 160px', fontSize: 16, fontWeight: 600 }}>
          {text.unfinished(resumeLabel)}
        </Typography>
        <Button
          onClick={onStartOver}
          sx={{ height: 44, color: colors.textSecondary, textTransform: 'none', fontSize: 15 }}
        >
          {text.startOver}
        </Button>
        <Button onClick={onResume} sx={{ ...primaryButton, height: 44, px: 2.5, fontSize: 15 }}>
          {text.resume}
        </Button>
      </Box>
    );
  } else {
    body = (
      <>
        {nothingDue ? (
          <Typography sx={{ color: colors.textSecondary }}>{text.nothingDue}</Typography>
        ) : (
          <Box
            role="group"
            aria-label={text.size}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}
          >
            {SESSION_SIZES.map((s) => {
              const on = s === size;
              const plan = sessionSizes?.[s];
              return (
                <ButtonBase
                  key={s}
                  aria-pressed={on}
                  onClick={() => setSize(s)}
                  sx={{
                    minHeight: 84,
                    p: 1.5,
                    borderRadius: 2,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    gap: 0.25,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: colors.text,
                    border: `1.5px solid ${on ? colors.primaryDark : colors.borderStrong}`,
                    bgcolor: on ? colors.successSurface : colors.card,
                  }}
                >
                  <Typography component="span" sx={{ fontSize: 15, fontWeight: 700 }}>
                    {text.sizes[s]}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {plan?.time}
                  </Typography>
                  <Typography component="span" sx={{ fontSize: 12, color: colors.textSecondary }}>
                    {text.questions(plan?.questions ?? 0)}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        )}
        <Button
          onClick={() => onStudy(size)}
          fullWidth
          sx={{ ...primaryButton, mt: 2, height: 52, fontSize: 17 }}
        >
          {text.study}
        </Button>
        {!nothingDue && chosen && chosen.newWords > 0 && (
          <Typography
            sx={{ mt: 0.75, textAlign: 'center', fontSize: 12, color: colors.textSecondary }}
          >
            {text.includesNew(chosen.newWords)}
          </Typography>
        )}
      </>
    );
  }

  return (
    <Card component="section" aria-labelledby="dashboard-today" sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography
          id="dashboard-today"
          component="h2"
          sx={{ m: 0, fontSize: 20, fontWeight: 700 }}
        >
          {text.today}
        </Typography>
        <ListMenu lists={lists} activeListId={activeListId} onSwitchList={onSwitchList} />
      </Box>
      {body}
    </Card>
  );
};

/** The active list's name, with a menu of the others. */
const ListMenu: React.FC<Pick<TodayCardProps, 'lists' | 'activeListId' | 'onSwitchList'>> = ({
  lists,
  activeListId,
  onSwitchList,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const options = [{ id: '__all__', name: text.allLists }, ...lists];
  const name = options.find((l) => l.id === activeListId)?.name ?? lists[0]?.name ?? '';
  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        aria-label={text.chooseList(name)}
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        sx={{ height: 44, px: 1, color: colors.text, fontSize: 15, textTransform: 'none' }}
      >
        {name}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {options.map((l) => (
          <MenuItem
            key={l.id}
            selected={l.id === activeListId}
            onClick={() => {
              onSwitchList(l.id);
              setAnchor(null);
            }}
          >
            {l.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default TodayCard;
