// PROTOTYPE (#403) variant F, "Coach": the Dashboard says what is going wrong
// and what is going right. The words that keep slipping come first, as cards;
// the five directions are ranked weakest first; the mastered words close the
// page. The session itself is one compact bar. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

import { colors, fonts, shadows } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { DIRECTIONS, Word } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { toneMarks } from '../../../utils/pinyinMarks';
import { DashboardVariantProps } from './dashboardShared';
import {
  isDue,
  lapsesOf,
  levelOf,
  strengthByDirection,
  weakestDirectionOf,
} from './dashboardWords';

export const name = 'Coach';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    variant="caption"
    sx={{
      display: 'block',
      color: colors.textSecondary,
      letterSpacing: '0.1em',
      mb: 1.25,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </Typography>
);

const VariantF: React.FC<DashboardVariantProps> = ({
  words,
  charSet,
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
  const text = (w: Word) => (charSet === 'simp' ? w.simp : w.trad);
  const empty = !loading && !error && words.length === 0;
  const ready = !loading && !error && !empty;

  const due = useMemo(() => words.filter((w) => isDue(w)).length, [words]);
  const slipping = useMemo(
    () =>
      words
        .filter((w) => lapsesOf(w) > 0)
        .sort((a, b) => lapsesOf(b) - lapsesOf(a))
        .slice(0, 8),
    [words],
  );
  const strength = useMemo(() => strengthByDirection(words), [words]);
  const ranked = [...DIRECTIONS].sort((a, b) => strength[a] - strength[b]);
  const mastered = useMemo(() => words.filter((w) => levelOf(w) >= 5), [words]);

  return (
    <Box
      sx={{
        maxWidth: 560,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3.5,
        pb: 24,
        textAlign: 'left',
      }}
    >
      {/* The session, as one bar. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: colors.text,
          color: colors.white,
          borderRadius: 2,
          pl: 2,
          pr: 1,
          py: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Select
            value={activeListId}
            onChange={(e) => onSwitchList(e.target.value)}
            variant="standard"
            disableUnderline
            sx={{
              color: colors.disabledText,
              fontSize: 13,
              '& .MuiSvgIcon-root': { color: colors.disabledText },
            }}
          >
            {[{ id: '__all__', name: 'All lists' }, ...lists].map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </Select>
          <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
            {loading
              ? '…'
              : error
                ? 'Could not load'
                : empty
                  ? 'No words yet'
                  : (resumeLabel ?? `${due} due · ${stats?.estimatedStudyTime ?? 'nothing today'}`)}
          </Typography>
        </Box>
        {resumeLabel && ready && (
          <Button onClick={onStartOver} sx={{ color: colors.disabledText, minWidth: 0 }}>
            Start over
          </Button>
        )}
        <Button
          onClick={error ? onRetry : empty ? onAddWords : resumeLabel ? onResume : onStart}
          disabled={loading}
          variant="contained"
          sx={{
            bgcolor: colors.primaryLight,
            color: colors.white,
            px: 2.5,
            py: 1.25,
            '&:hover': { bgcolor: colors.primaryLightHover },
          }}
        >
          {error ? 'Try again' : empty ? 'Add words' : resumeLabel ? 'Resume' : 'Start'}
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" width={140} height={170} />
          ))}
        </Box>
      )}

      {empty && (
        <Box sx={{ textAlign: 'center', py: 6, color: colors.textSecondary }}>
          <Typography
            sx={{ fontFamily: fonts.hanzi, fontSize: 64, color: colors.outline, lineHeight: 1 }}
          >
            学
          </Typography>
          <Typography sx={{ mt: 2 }}>No words yet</Typography>
        </Box>
      )}

      {ready && slipping.length > 0 && (
        <Box>
          <Heading>Slipping</Heading>
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              overflowX: 'auto',
              mx: -2,
              px: 2,
              pb: 1,
              scrollbarWidth: 'none',
            }}
          >
            {slipping.map((w) => {
              const lapses = lapsesOf(w);
              const weak = weakestDirectionOf(w);
              return (
                <Box
                  key={w.id}
                  sx={{
                    flex: '0 0 148px',
                    bgcolor: colors.card,
                    boxShadow: shadows.card,
                    borderRadius: 2,
                    p: 1.75,
                    borderTop: `3px solid ${lapses >= 8 ? colors.primaryLight : colors.warning}`,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: fonts.hanzi,
                      fontSize: 40,
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {text(w)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {toneMarks(w.pinyin)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {w.meaning}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '3px', mt: 1.25 }}>
                    {Array.from({ length: Math.min(lapses, 10) }, (_, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: lapses >= 8 ? colors.primaryLight : colors.warning,
                        }}
                      />
                    ))}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    {DIRECTION_LABELS[weak]}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {ready && (
        <Box>
          <Heading>Skills, weakest first</Heading>
          {ranked.map((d, i) => (
            <Box
              key={d}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                borderBottom: `1px solid ${colors.divider}`,
              }}
            >
              <Typography
                sx={{
                  flex: '0 0 170px',
                  fontWeight: i === 0 ? 700 : 400,
                  color: i === 0 ? colors.primaryLight : colors.text,
                  fontSize: 15,
                }}
              >
                {DIRECTION_LABELS[d]}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  height: 6,
                  bgcolor: colors.outline,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${strength[d] * 100}%`,
                    height: '100%',
                    bgcolor: i === 0 ? colors.primaryLight : colors.primaryDark,
                  }}
                />
              </Box>
              <Typography
                sx={{
                  flex: '0 0 40px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 14,
                }}
              >
                {Math.round(strength[d] * 100)}%
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {ready && mastered.length > 0 && (
        <Box>
          <Heading>Mastered · {mastered.length}</Heading>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            {mastered.map((w) => (
              <Typography
                key={w.id}
                sx={{ fontFamily: fonts.hanzi, fontSize: 24, color: colors.primaryDark }}
              >
                {text(w)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      <ButtonBase
        onClick={() => setChengyuOpen(true)}
        sx={{ justifyContent: 'space-between', borderTop: `1px solid ${colors.divider}`, pt: 2 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '0.1em' }}>
          CHENGYU
        </Typography>
        <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 24, letterSpacing: '0.1em' }}>
          {charSet === 'simp' ? daily.chengyu : daily.tradChengyu}
        </Typography>
      </ButtonBase>

      <Dialog open={chengyuOpen} onClose={() => setChengyuOpen(false)} fullWidth maxWidth="sm">
        <ErrorBoundary>
          <Chengyu />
        </ErrorBoundary>
      </Dialog>
    </Box>
  );
};

export default VariantF;
