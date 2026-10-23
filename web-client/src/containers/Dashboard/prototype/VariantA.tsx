// PROTOTYPE (#403) variant A, "Thumb": one huge due count and a Start button
// pinned in the thumb zone above the tab bar. Everything else sits below the
// fold, folded. Throwaway.
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';

import { colors, fonts, shadows } from '../../../theme';
import { TAB_BAR_HEIGHT } from '../../../components/Navigation/TabBar/TabBar';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { DIRECTIONS } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { BankBar, DashboardVariantProps } from './dashboardShared';

export const name = 'Thumb';

const ListPill: React.FC<DashboardVariantProps> = ({
  lists,
  activeListId,
  activeListName,
  listStats,
  onSwitchList,
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const options = [{ id: '__all__', name: 'All lists' }, ...lists];
  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMoreIcon />}
        sx={{
          color: colors.text,
          bgcolor: colors.card,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 999,
          px: 2,
        }}
      >
        {activeListName}
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
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 3, minWidth: 200 }}
          >
            <span>{l.name}</span>
            {listStats[l.id] && (
              <Typography variant="caption" color="text.secondary">
                {listStats[l.id].due} due
              </Typography>
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

const VariantA: React.FC<DashboardVariantProps> = (props) => {
  const {
    stats,
    loading,
    error,
    resumeLabel,
    onStart,
    onResume,
    onStartOver,
    onAddWords,
    onRetry,
  } = props;
  const [skillsOpen, setSkillsOpen] = useState(false);
  const empty = !loading && !error && (stats?.totalWords ?? 0) === 0;
  const due = stats?.dueWords ?? 0;

  let primary: { label: string; onClick: () => void } | null = null;
  if (!loading && !error) {
    if (resumeLabel) primary = { label: `Resume · ${resumeLabel}`, onClick: onResume };
    else if (empty) primary = { label: 'Add your first words', onClick: onAddWords };
    else if (due > 0) primary = { label: 'Start', onClick: onStart };
    else primary = { label: 'Practise anyway', onClick: onStart };
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', pb: { xs: 20, sm: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ListPill {...props} />
        {!loading && !error && !empty && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: colors.textSecondary }}
          >
            <LocalFireDepartmentOutlinedIcon fontSize="small" />
            <Typography variant="body2">{stats?.streak ?? 0}</Typography>
          </Box>
        )}
      </Box>

      {/* The hero: one number. */}
      <Box sx={{ textAlign: 'center', py: { xs: 7, sm: 9 } }}>
        {loading && (
          <>
            <Skeleton variant="text" sx={{ fontSize: 120, width: 160, mx: 'auto' }} />
            <Skeleton variant="text" sx={{ width: 120, mx: 'auto' }} />
          </>
        )}
        {error && (
          <Box role="alert">
            <Typography sx={{ color: 'error.main', mb: 2 }}>Could not load your words.</Typography>
            <Button onClick={onRetry} variant="outlined" color="inherit">
              Try again
            </Button>
          </Box>
        )}
        {empty && (
          <>
            <Typography
              sx={{ fontFamily: fonts.hanzi, fontSize: 120, lineHeight: 1, color: colors.outline }}
            >
              空
            </Typography>
            <Typography variant="h6" sx={{ mt: 2 }}>
              No words yet
            </Typography>
          </>
        )}
        {!loading && !error && !empty && (
          <>
            <Typography
              sx={{
                fontSize: { xs: 128, sm: 160 },
                fontWeight: 700,
                lineHeight: 1,
                color: resumeLabel ? colors.textSecondary : colors.text,
                letterSpacing: '-0.04em',
              }}
            >
              {due}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
              {due === 0 ? 'All done for today' : `due · ${stats?.estimatedStudyTime ?? ''}`}
            </Typography>
          </>
        )}
      </Box>

      {/* The thumb zone: pinned above the tab bar on a phone, inline on a desktop. */}
      {primary && (
        <Box
          sx={{
            position: { xs: 'fixed', sm: 'static' },
            left: 0,
            right: 0,
            // Clear of the tab bar's raised Study button.
            bottom: { xs: `calc(${TAB_BAR_HEIGHT + 28}px + env(safe-area-inset-bottom))` },
            px: { xs: 2, sm: 0 },
            py: { xs: 1.5, sm: 0 },
            bgcolor: { xs: colors.paper, sm: 'transparent' },
            borderTop: { xs: `1px solid ${colors.divider}`, sm: 'none' },
            zIndex: 10,
            display: 'flex',
            gap: 1,
            maxWidth: { sm: 420 },
            mx: { sm: 'auto' },
            width: { sm: '100%' },
          }}
        >
          <Button
            onClick={primary.onClick}
            variant="contained"
            size="large"
            sx={{
              flex: 1,
              bgcolor: colors.primaryDark,
              color: colors.white,
              py: 1.75,
              fontSize: 18,
              borderRadius: 3,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            {primary.label}
          </Button>
          {resumeLabel && (
            <Button onClick={onStartOver} sx={{ color: colors.textSecondary, flex: '0 0 auto' }}>
              Start over
            </Button>
          )}
        </Box>
      )}

      {!loading && !error && !empty && (
        <>
          <Button
            onClick={() => setSkillsOpen((o) => !o)}
            endIcon={
              <ExpandMoreIcon
                sx={{ transform: skillsOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            }
            sx={{ color: colors.textSecondary, alignSelf: 'center', mt: { sm: 4 } }}
          >
            {stats?.totalWords} words · {stats?.weeklyStats.sessions} sessions this week
          </Button>
          <Collapse in={skillsOpen}>
            <Box
              sx={{
                bgcolor: colors.card,
                boxShadow: shadows.card,
                borderRadius: 2,
                p: 2,
                mt: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {DIRECTIONS.map((d) => (
                <Box key={d}>
                  <Typography variant="caption" color="text.secondary">
                    {DIRECTION_LABELS[d]}
                  </Typography>
                  <BankBar counts={stats?.directionDistribution[d]} />
                </Box>
              ))}
            </Box>
          </Collapse>
        </>
      )}

      {!loading && (
        <Box sx={{ mt: 4 }}>
          <ErrorBoundary>
            <Chengyu />
          </ErrorBoundary>
        </Box>
      )}
    </Box>
  );
};

export default VariantA;
