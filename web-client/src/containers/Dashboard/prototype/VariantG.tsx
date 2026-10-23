// PROTOTYPE (#403) variant G, "Ink wall": the whole collection is the
// Dashboard. Every word is one tile; the ink darkens as the word's level rises,
// and a red dot marks a word due today. The learner sees their vocabulary grow,
// and taps a word to see its five directions. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Skeleton from '@mui/material/Skeleton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { colors, fonts } from '../../../theme';
import Chengyu from '../../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { getDailyChengyu } from '../../../data/chengyus';
import { DIRECTIONS, Word } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { BANK_LABELS } from '../../../utils/scheduling';
import { toneMarks } from '../../../utils/pinyinMarks';
import { DashboardVariantProps } from './dashboardShared';
import { isDue, levelOf } from './dashboardWords';

export const name = 'Ink wall';

const inkOpacity: Record<number, number> = { 1: 0.22, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1 };

type Filter = 'all' | 'due' | number;

const VariantG: React.FC<DashboardVariantProps> = ({
  words,
  charSet,
  stats,
  loading,
  error,
  resumeLabel,
  lists,
  activeListId,
  activeListName,
  onSwitchList,
  onStart,
  onResume,
  onStartOver,
  onAddWords,
  onRetry,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<Word | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [chengyuOpen, setChengyuOpen] = useState(false);
  const daily = useMemo(() => getDailyChengyu(), []);
  const text = (w: Word) => (charSet === 'simp' ? w.simp : w.trad);
  const empty = !loading && !error && words.length === 0;

  const due = useMemo(() => words.filter((w) => isDue(w)), [words]);
  const sorted = useMemo(() => [...words].sort((a, b) => levelOf(b) - levelOf(a)), [words]);
  const shown =
    filter === 'all'
      ? sorted
      : filter === 'due'
        ? sorted.filter((w) => isDue(w))
        : sorted.filter((w) => levelOf(w) === filter);
  const byLevel = [1, 2, 3, 4, 5].map((l) => words.filter((w) => levelOf(w) === l).length);

  const chip = (key: Filter, label: React.ReactNode) => (
    <ButtonBase
      key={String(key)}
      onClick={() => setFilter(filter === key ? 'all' : key)}
      sx={{
        flex: '0 0 auto',
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        fontFamily: 'inherit',
        fontSize: 13,
        gap: 0.75,
        border: `1px solid ${filter === key ? colors.text : colors.borderStrong}`,
        bgcolor: filter === key ? colors.text : 'transparent',
        color: filter === key ? colors.white : colors.text,
      }}
    >
      {label}
    </ButtonBase>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 24, textAlign: 'left' }}>
      {/* The head: the collection's size, and the session. */}
      <Box
        sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <ButtonBase
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={{ fontFamily: 'inherit', color: colors.textSecondary, fontSize: 14 }}
          >
            {activeListName} <ExpandMoreIcon fontSize="small" />
          </ButtonBase>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            {[{ id: '__all__', name: 'All lists' }, ...lists].map((l) => (
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
          <Typography sx={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
            {loading ? '–' : words.length}
            <Typography
              component="span"
              sx={{ fontSize: 16, fontWeight: 400, color: colors.textSecondary, ml: 1 }}
            >
              words
            </Typography>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <Button
            onClick={error ? onRetry : empty ? onAddWords : resumeLabel ? onResume : onStart}
            disabled={loading}
            variant="contained"
            sx={{
              bgcolor: colors.primaryDark,
              color: colors.white,
              px: 2.5,
              '&:hover': { bgcolor: colors.primaryDarkHover },
            }}
          >
            {error
              ? 'Try again'
              : empty
                ? 'Add words'
                : resumeLabel
                  ? `Resume · ${resumeLabel}`
                  : `Study ${due.length} due`}
          </Button>
          {resumeLabel && !empty && (
            <Button onClick={onStartOver} size="small" sx={{ color: colors.textSecondary }}>
              Start over
            </Button>
          )}
          {!resumeLabel && !empty && !loading && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {stats?.estimatedStudyTime}
            </Typography>
          )}
        </Box>
      </Box>

      {/* The level scale doubles as the filter. */}
      {!empty && !loading && !error && (
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chip(
            'due',
            <>
              <Box
                sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colors.primaryLight }}
              />
              Due {due.length}
            </>,
          )}
          {[5, 4, 3, 2, 1].map((l) =>
            chip(
              l,
              <>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: 0.5,
                    bgcolor: colors.text,
                    opacity: inkOpacity[l],
                  }}
                />
                {BANK_LABELS[l]} {byLevel[l - 1]}
              </>,
            ),
          )}
        </Box>
      )}

      {error && <Typography sx={{ color: colors.error }}>Could not load your words.</Typography>}

      {/* The wall. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {/* Today's chengyu is the wall's first, red tile. */}
        {!loading && (
          <ButtonBase
            onClick={() => setChengyuOpen(true)}
            sx={{
              px: 1,
              height: 48,
              borderRadius: 1,
              bgcolor: colors.primaryLight,
              color: colors.white,
              fontFamily: fonts.hanzi,
              fontSize: 22,
              letterSpacing: '0.08em',
            }}
          >
            {charSet === 'simp' ? daily.chengyu : daily.tradChengyu}
          </ButtonBase>
        )}
        {loading &&
          Array.from({ length: 40 }, (_, i) => (
            <Skeleton key={i} variant="rounded" width={i % 3 ? 64 : 40} height={48} />
          ))}
        {empty &&
          Array.from({ length: 30 }, (_, i) => (
            <Box
              key={i}
              sx={{
                width: i % 3 ? 64 : 40,
                height: 48,
                borderRadius: 1,
                border: `1px dashed ${colors.borderStrong}`,
              }}
            />
          ))}
        {!loading &&
          shown.map((w) => (
            <ButtonBase
              key={w.id}
              onClick={() => setPicked(w)}
              sx={{
                position: 'relative',
                px: 1,
                height: 48,
                minWidth: 40,
                borderRadius: 1,
                bgcolor: colors.card,
                border: `1px solid ${colors.divider}`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: fonts.hanzi,
                  fontSize: 24,
                  lineHeight: 1,
                  color: colors.text,
                  opacity: inkOpacity[levelOf(w)] ?? 0.22,
                }}
              >
                {text(w)}
              </Typography>
              {isDue(w) && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: colors.primaryLight,
                  }}
                />
              )}
            </ButtonBase>
          ))}
      </Box>

      {/* A word's card. */}
      <Drawer
        anchor="bottom"
        open={!!picked}
        onClose={() => setPicked(null)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 3, pb: 5 } }}
      >
        {picked && (
          <Box sx={{ maxWidth: 480, mx: 'auto', width: '100%' }}>
            <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 56, lineHeight: 1.1 }}>
              {text(picked)}
            </Typography>
            <Typography color="text.secondary">{toneMarks(picked.pinyin)}</Typography>
            <Typography sx={{ mt: 0.5, mb: 2.5 }}>
              {picked.ammended_meaning || picked.meaning}
            </Typography>
            {DIRECTIONS.map((d) => {
              const lv = picked.directions?.[d]?.level ?? levelOf(picked);
              return (
                <Box key={d} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
                  <Typography variant="body2" sx={{ flex: '0 0 170px' }}>
                    {DIRECTION_LABELS[d]}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: '3px' }}>
                    {[1, 2, 3, 4, 5].map((l) => (
                      <Box
                        key={l}
                        sx={{
                          width: 18,
                          height: 8,
                          borderRadius: 1,
                          bgcolor: l <= lv ? colors.primaryDark : colors.outline,
                        }}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {BANK_LABELS[lv]}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </Drawer>

      <Dialog open={chengyuOpen} onClose={() => setChengyuOpen(false)} fullWidth maxWidth="sm">
        <ErrorBoundary>
          <Chengyu />
        </ErrorBoundary>
      </Dialog>
    </Box>
  );
};

export default VariantG;
