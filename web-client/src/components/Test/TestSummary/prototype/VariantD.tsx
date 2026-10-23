// PROTOTYPE (#414) variant D, "Score and tiles": the score card of A on top,
// and the word tiles of C under it in place of A's missed-word list. Misses
// come first; a tap turns a tile to its pinyin and meaning. A tap on a count
// under the bar filters the tiles. The empty state is A's. Throwaway.
import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import { StudyButton, StudyCard, hanziSx } from '../../Study/parts';
import { colors } from '../../../../theme';
import { DirectionResult } from '../../../../types/models';
import { DIRECTION_LABELS } from '../../../../utils/directions';
import VariantA from './VariantA';
import {
  SummaryProps,
  SwitcherGap,
  VariantModule,
  protoCopy,
  resultFill,
  resultInk,
  resultLabel,
  resultSurface,
  tally,
} from './shared';

const order: Record<DirectionResult, number> = { fail: 0, lapse: 1, pass: 2 };

const Summary: React.FC<SummaryProps> = ({ rows, practiceMode, onHome, onPracticeMissed }) => {
  const [filter, setFilter] = useState<DirectionResult | null>(null);
  const [turned, setTurned] = useState<number | null>(null);
  const t = tally(rows);
  const shown = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !filter || row.result === filter)
    .sort((a, b) => order[a.row.result] - order[b.row.result]);

  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageDone} done={t.total} total={t.total} onEnd={onHome} />
      <StudyCard sx={{ mt: 3, py: 3.5 }} seal={false}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Box sx={{ fontSize: 64, fontWeight: 700, lineHeight: 1, color: colors.primaryDark }}>
            {t.pass}
          </Box>
          <Box sx={{ fontSize: 24, color: colors.textSecondary }}>/ {t.total}</Box>
        </Box>
        <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
          {protoCopy.questionsWords(t.total, t.words)}
        </Box>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            height: 10,
            borderRadius: 1,
            overflow: 'hidden',
            mt: 1,
            bgcolor: colors.divider,
          }}
        >
          {(['pass', 'lapse', 'fail'] as const).map((r) =>
            t[r] > 0 ? <Box key={r} sx={{ flex: t[r], bgcolor: resultFill[r] }} /> : null,
          )}
        </Box>
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
          {(['pass', 'lapse', 'fail'] as const).map((r) => {
            const on = filter === r;
            return (
              <ButtonBase
                key={r}
                onClick={() => setFilter(on ? null : r)}
                aria-pressed={on}
                disabled={t[r] === 0}
                sx={{
                  px: 1,
                  py: 0.5,
                  mx: -1,
                  borderRadius: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: resultInk[r],
                  bgcolor: on ? resultSurface[r] : 'transparent',
                  outline: on ? `1px solid ${resultFill[r]}` : 'none',
                }}
              >
                {t[r]} {resultLabel[r]}
              </ButtonBase>
            );
          })}
        </Box>
        {practiceMode && (
          <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{protoCopy.practiceNote}</Box>
        )}
      </StudyCard>

      <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {shown.map(({ row, i }) => {
          const isTurned = turned === i;
          return (
            <ButtonBase
              key={i}
              onClick={() => setTurned(isTurned ? null : i)}
              aria-pressed={isTurned}
              sx={{
                height: 84,
                px: 1,
                borderRadius: 1,
                bgcolor: colors.card,
                border: `1px solid ${colors.divider}`,
                borderTop: `4px solid ${resultFill[row.result]}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                overflow: 'hidden',
              }}
            >
              {isTurned ? (
                <>
                  <Box lang="zh-Latn" sx={{ fontSize: 14 }}>
                    {row.pinyin}
                  </Box>
                  <Box
                    sx={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      lineHeight: 1.2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {row.meaning}
                  </Box>
                  <Box sx={{ fontSize: 10, color: colors.placeholder }}>
                    {DIRECTION_LABELS[row.direction]}
                  </Box>
                </>
              ) : (
                <Box lang="zh" sx={hanziSx(row.char.length > 2 ? 22 : 30)}>
                  {row.char}
                </Box>
              )}
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {t.fail + t.lapse > 0 && (
          <StudyButton onClick={onPracticeMissed}>{protoCopy.practiceMissed}</StudyButton>
        )}
        <StudyButton variant="primary" onClick={onHome}>
          {protoCopy.backToDashboard}
        </StudyButton>
      </Box>
      <SwitcherGap />
    </StudyScreen>
  );
};

const VariantD: VariantModule = { Summary, Empty: VariantA.Empty };
export default VariantD;
