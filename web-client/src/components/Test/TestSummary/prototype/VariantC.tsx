// PROTOTYPE (#414) variant C, "Word tiles": the words are the summary. Each
// question is a tile in a grid, edged by its result, misses first; a tap turns
// the tile to its pinyin and meaning. Three counters on top filter the grid.
// The empty state is a chooser of lists, so the next tap starts a session on
// another list, or practice on this one. Throwaway.
import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import { StudyButton, TextButton, hanziSx } from '../../Study/parts';
import { colors } from '../../../../theme';
import { DirectionResult } from '../../../../types/models';
import { DIRECTION_LABELS } from '../../../../utils/directions';
import {
  EmptyProps,
  SummaryProps,
  VariantModule,
  firstUpcoming,
  SwitcherGap,
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
      <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {(['pass', 'lapse', 'fail'] as const).map((r) => {
          const on = filter === r;
          return (
            <ButtonBase
              key={r}
              onClick={() => setFilter(on ? null : r)}
              aria-pressed={on}
              sx={{
                py: 1.25,
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${on ? resultFill[r] : colors.divider}`,
                bgcolor: on ? resultSurface[r] : colors.card,
              }}
            >
              <Box sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: resultInk[r] }}>
                {t[r]}
              </Box>
              <Box sx={{ fontSize: 12, color: colors.textSecondary }}>{resultLabel[r]}</Box>
            </ButtonBase>
          );
        })}
      </Box>
      {practiceMode && (
        <Box sx={{ mt: 1, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
          {protoCopy.practiceNote}
        </Box>
      )}

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          maxHeight: 'calc(100dvh - 330px)',
          overflowY: 'auto',
        }}
      >
        {shown.map(({ row, i }) => {
          const isTurned = turned === i;
          return (
            <ButtonBase
              key={i}
              onClick={() => setTurned(isTurned ? null : i)}
              aria-pressed={isTurned}
              sx={{
                height: 96,
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
                <Box lang="zh" sx={hanziSx(row.char.length > 2 ? 24 : 32)}>
                  {row.char}
                </Box>
              )}
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton variant="primary" onClick={onHome}>
        {protoCopy.done}
      </StudyButton>
      {t.fail + t.lapse > 0 && (
        <TextButton onClick={onPracticeMissed}>{protoCopy.practiceMissed}</TextButton>
      )}
      <SwitcherGap />
    </StudyScreen>
  );
};

const Empty: React.FC<EmptyProps> = (p) => {
  const lists = [
    { id: '__current__', name: p.isAllLists ? protoCopy.allLists : p.listName, due: 0 },
    ...p.otherLists,
    ...(p.hasMultipleLists && p.totalDue > 0 && !p.isAllLists
      ? [{ id: '__all__', name: protoCopy.allLists, due: p.totalDue }]
      : []),
  ];
  const firstDue = lists.find((l) => l.due > 0);
  const [chosen, setChosen] = useState<string>(firstDue?.id ?? '__current__');
  const pick = lists.find((l) => l.id === chosen) ?? lists[0];
  const next = firstUpcoming(p.upcoming);

  const start = () => {
    if (pick.id === '__all__') p.onTestAll();
    else if (pick.due > 0) p.onSwitchList(pick.id);
    else p.onPractice();
  };

  if (!p.hasWords) {
    return (
      <StudyScreen>
        <StudyTop stage={protoCopy.stageTest} done={0} total={0} onEnd={p.onHome} />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Box sx={{ fontSize: 28, fontWeight: 600, textAlign: 'center' }}>{protoCopy.noWords}</Box>
        </Box>
        <StudyButton variant="primary" onClick={p.onAddWords}>
          {protoCopy.addWords}
        </StudyButton>
        <SwitcherGap />
      </StudyScreen>
    );
  }

  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageTest} done={0} total={0} onEnd={p.onHome} />
      <Box sx={{ mt: 4, mb: 3 }}>
        <Box sx={{ fontSize: 28, fontWeight: 600 }}>{protoCopy.allCaughtUp}</Box>
        {next && (
          <Box sx={{ fontSize: 15, color: colors.textSecondary, mt: 0.5 }}>
            {protoCopy.nextDue(next.n, next.day)}
          </Box>
        )}
      </Box>

      <Box role="radiogroup" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {lists.map((l) => {
          const on = l.id === chosen;
          return (
            <ButtonBase
              key={l.id}
              role="radio"
              aria-checked={on}
              onClick={() => setChosen(l.id)}
              sx={{
                height: 56,
                px: 2,
                gap: 1.5,
                justifyContent: 'flex-start',
                borderRadius: 1,
                fontSize: 16,
                bgcolor: on ? colors.successSurface : colors.card,
                border: `1px solid ${on ? colors.primaryDark : colors.divider}`,
              }}
            >
              {on ? (
                <RadioButtonCheckedRoundedIcon sx={{ color: colors.primaryDark }} />
              ) : (
                <RadioButtonUncheckedRoundedIcon sx={{ color: colors.borderStrong }} />
              )}
              <Box sx={{ flex: 1, textAlign: 'left' }}>{l.name}</Box>
              <Box
                sx={{
                  fontWeight: 600,
                  color: l.due ? colors.primaryDark : colors.placeholder,
                }}
              >
                {protoCopy.dueCount(l.due)}
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton variant="primary" onClick={start}>
        {pick.due > 0 ? protoCopy.studyList(pick.name) : protoCopy.practice}
      </StudyButton>
      <TextButton onClick={p.onAddWords}>{protoCopy.addWords}</TextButton>
      <SwitcherGap />
    </StudyScreen>
  );
};

const VariantC: VariantModule = { Summary, Empty };
export default VariantC;
