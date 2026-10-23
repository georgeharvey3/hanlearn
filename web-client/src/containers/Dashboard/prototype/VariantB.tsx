// PROTOTYPE (#403) variant B, "Notebook": the daily chengyu is the masthead,
// lists are tabs, and the rest is a ruled ledger of rows. Each row is one
// fact; the "Today" row is the session's door. No cards. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { colors, fonts } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { DIRECTIONS } from '../../../types/models';
import { DashboardVariantProps, DIRECTION_SHORT, strengthOf } from './dashboardShared';

export const name = 'Notebook';

const rule = `1px solid ${colors.gridLine}`;

const Row: React.FC<{
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  accent?: string;
}> = ({ label, children, onClick, accent }) => {
  const body = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: 56,
        borderBottom: rule,
        textAlign: 'left',
        gap: 2,
        color: accent ?? colors.text,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          flex: '0 0 72px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: accent ?? colors.textSecondary,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      {onClick && <ChevronRightIcon />}
    </Box>
  );
  return onClick ? (
    <ButtonBase onClick={onClick} sx={{ width: '100%', display: 'block' }}>
      {body}
    </ButtonBase>
  ) : (
    body
  );
};

const VariantB: React.FC<DashboardVariantProps> = ({
  stats,
  loading,
  error,
  resumeLabel,
  lists,
  activeListId,
  onSwitchList,
  onStart,
  onResume,
  onStartOver,
  onAddWords,
  onRetry,
}) => {
  const [chengyuOpen, setChengyuOpen] = useState(false);
  const daily = useMemo(() => getDailyChengyu(), []);
  const charSet = localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad';
  const chengyuChars = charSet === 'simp' ? daily.chengyu : daily.tradChengyu;
  const empty = !loading && !error && (stats?.totalWords ?? 0) === 0;
  const due = stats?.dueWords ?? 0;
  const tabs = [{ id: '__all__', name: 'All' }, ...lists];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Masthead: today's chengyu, large, tap to play. */}
      <ButtonBase
        onClick={() => setChengyuOpen(true)}
        sx={{
          display: 'block',
          textAlign: 'center',
          py: 3,
          borderBottom: `3px double ${colors.text}`,
        }}
      >
        <Typography
          sx={{
            fontFamily: fonts.hanzi,
            fontSize: { xs: 52, sm: 64 },
            lineHeight: 1.1,
            letterSpacing: '0.12em',
          }}
        >
          {chengyuChars}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {daily.pinyin} · today&apos;s chengyu
        </Typography>
      </ButtonBase>

      {/* Lists as tabs. */}
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          overflowX: 'auto',
          borderBottom: rule,
          py: 1.25,
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((l) => (
          <ButtonBase
            key={l.id}
            onClick={() => onSwitchList(l.id)}
            sx={{
              flex: '0 0 auto',
              fontFamily: 'inherit',
              fontSize: 15,
              pb: 0.25,
              fontWeight: l.id === activeListId ? 700 : 400,
              color: l.id === activeListId ? colors.text : colors.textSecondary,
              borderBottom: `2px solid ${l.id === activeListId ? colors.primaryLight : 'transparent'}`,
            }}
          >
            {l.name}
          </ButtonBase>
        ))}
      </Box>

      {loading &&
        [0, 1, 2, 3].map((i) => (
          <Row key={i} label=" ">
            <Skeleton variant="text" width={`${60 - i * 10}%`} />
          </Row>
        ))}

      {error && (
        <Row label="Error" onClick={onRetry} accent={colors.error}>
          Could not load. Try again
        </Row>
      )}

      {empty && (
        <>
          <Row label="Today" onClick={onAddWords} accent={colors.primaryDark}>
            <Typography sx={{ fontWeight: 700 }}>Add your first words</Typography>
          </Row>
          {[0, 1, 2].map((i) => (
            <Row key={i} label=" ">
              {' '}
            </Row>
          ))}
        </>
      )}

      {!loading && !error && !empty && stats && (
        <>
          {resumeLabel ? (
            <>
              <Row label="Unfinished" onClick={onResume} accent={colors.primaryLight}>
                <Typography sx={{ fontWeight: 700 }}>Resume · {resumeLabel}</Typography>
              </Row>
              <Row label=" " onClick={onStartOver}>
                <Typography color="text.secondary">Start over</Typography>
              </Row>
            </>
          ) : (
            <Row label="Today" onClick={onStart} accent={colors.primaryDark}>
              <Typography sx={{ fontWeight: 700, fontSize: 20 }}>
                {due === 0 ? 'Nothing due · practise' : `${due} due`}
                {due > 0 && (
                  <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                    {stats.estimatedStudyTime}
                  </Typography>
                )}
              </Typography>
            </Row>
          )}

          <Row label="Week">
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
              {/* Prototype: the last 7 days lit from the streak. */}
              {Array.from({ length: 7 }, (_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: `1.5px solid ${colors.primaryLight}`,
                    bgcolor: 6 - i < stats.streak ? colors.primaryLight : 'transparent',
                  }}
                />
              ))}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                {stats.weeklyStats.wordsReviewed} reviewed
              </Typography>
            </Box>
          </Row>

          <Row label="Words">
            <Typography>
              {stats.totalWords}
              <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                {stats.masteredCount} mastered
              </Typography>
            </Typography>
          </Row>

          {DIRECTIONS.map((d, i) => (
            <Row key={d} label={i === 0 ? 'Skills' : ' '}>
              <Box
                sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <Typography>
                  <span style={{ fontFamily: fonts.hanzi }}>{DIRECTION_SHORT[d].from}</span>
                  {' → '}
                  <span style={{ fontFamily: fonts.hanzi }}>{DIRECTION_SHORT[d].to}</span>
                </Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {Math.round(strengthOf(stats.directionDistribution[d]) * 100)}%
                </Typography>
              </Box>
            </Row>
          ))}
        </>
      )}

      <Dialog open={chengyuOpen} onClose={() => setChengyuOpen(false)} fullWidth maxWidth="sm">
        <ErrorBoundary>
          <Chengyu />
        </ErrorBoundary>
      </Dialog>
    </Box>
  );
};

export default VariantB;
