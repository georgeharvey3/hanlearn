// PROTOTYPE (#414) variant B, "By direction": the summary is five rows, one
// per direction, each with a mark per question. A tap on a row opens the words
// of that direction. No score number. The empty state is the week ahead as
// columns of due counts (counts only, never the words). Throwaway.
import React, { useState } from 'react';
import { Box, ButtonBase, Collapse } from '@mui/material';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import { Overline, StudyButton, hanziSx } from '../../Study/parts';
import { colors } from '../../../../theme';
import { DIRECTIONS, Direction } from '../../../../types/models';
import { DIRECTION_LABELS } from '../../../../utils/directions';
import {
  EmptyProps,
  SummaryProps,
  VariantModule,
  SwitcherGap,
  protoCopy,
  resultFill,
  resultInk,
  resultSurface,
  tally,
} from './shared';

const Summary: React.FC<SummaryProps> = ({ rows, practiceMode, onHome }) => {
  const [open, setOpen] = useState<Direction | null>(null);
  const t = tally(rows);

  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageDone} done={t.total} total={t.total} onEnd={onHome} />
      <Box sx={{ mt: 3, mb: 2, textAlign: 'center' }}>
        <Box sx={{ fontSize: 22, fontWeight: 600 }}>{protoCopy.knownOf(t.pass, t.total)}</Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary, mt: 0.5 }}>
          {practiceMode ? protoCopy.practiceNote : protoCopy.questionsWords(t.total, t.words)}
        </Box>
      </Box>

      <Box
        sx={{
          bgcolor: colors.card,
          border: `1px solid ${colors.divider}`,
          borderRadius: 1,
        }}
      >
        {DIRECTIONS.map((d, i) => {
          const asked = rows.filter((r) => r.direction === d);
          const known = asked.filter((r) => r.result === 'pass').length;
          const isOpen = open === d;
          return (
            <Box key={d} sx={{ borderTop: i ? `1px solid ${colors.divider}` : 'none' }}>
              <ButtonBase
                disabled={asked.length === 0}
                onClick={() => setOpen(isOpen ? null : d)}
                aria-expanded={isOpen}
                sx={{
                  width: '100%',
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0.75,
                  opacity: asked.length === 0 ? 0.45 : 1,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 14,
                  }}
                >
                  <span>{DIRECTION_LABELS[d]}</span>
                  <Box
                    component="span"
                    sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                  >
                    {asked.length ? `${known}/${asked.length}` : '—'}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', minHeight: 10 }}>
                  {asked.map((r, j) => (
                    <Box
                      key={j}
                      sx={{
                        width: 18,
                        height: 10,
                        borderRadius: '2px',
                        bgcolor: resultFill[r.result],
                      }}
                    />
                  ))}
                </Box>
              </ButtonBase>
              <Collapse in={isOpen}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                  {asked.map((r, j) => (
                    <Box
                      key={j}
                      sx={{
                        px: 1.25,
                        py: 0.75,
                        borderRadius: 1,
                        bgcolor: resultSurface[r.result],
                        color: resultInk[r.result],
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <Box lang="zh" sx={hanziSx(24)}>
                        {r.char}
                      </Box>
                      <Box lang="zh-Latn" sx={{ fontSize: 12, mt: 0.5 }}>
                        {r.pinyin}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton variant="primary" onClick={onHome}>
        {protoCopy.done}
      </StudyButton>
      <SwitcherGap />
    </StudyScreen>
  );
};

const dayLetter = (offset: number): string =>
  new Date(Date.now() + offset * 86400000).toLocaleDateString(undefined, { weekday: 'narrow' });

const Empty: React.FC<EmptyProps> = (p) => {
  const max = Math.max(1, ...p.upcoming);
  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageTest} done={0} total={0} onEnd={p.onHome} />
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Box sx={{ fontSize: 22, fontWeight: 600 }}>
          {p.hasWords ? protoCopy.nothingDue : protoCopy.noWords}
        </Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary, mt: 0.5 }}>
          {p.isAllLists ? protoCopy.allLists : p.listName}
        </Box>
      </Box>

      {p.hasWords && (
        <Box sx={{ mt: 3 }}>
          <Overline sx={{ mb: 1 }}>{protoCopy.thisWeek}</Overline>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 0.75,
              alignItems: 'end',
              height: 140,
              px: 1.5,
              pt: 1.5,
              bgcolor: colors.card,
              border: `1px solid ${colors.divider}`,
              borderRadius: 1,
            }}
          >
            {[0, ...p.upcoming].map((n, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  height: '100%',
                  gap: 0.5,
                  fontSize: 12,
                }}
              >
                <Box sx={{ color: colors.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
                  {n || ''}
                </Box>
                <Box
                  sx={{
                    width: '100%',
                    height: `${(n / max) * 80}px`,
                    minHeight: 3,
                    borderRadius: '2px 2px 0 0',
                    bgcolor:
                      i === 0 ? colors.primaryLight : n ? colors.primaryDark : colors.blankDay,
                  }}
                />
                <Box
                  sx={{
                    pb: 1,
                    color: i === 0 ? colors.primaryLight : colors.textSecondary,
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >
                  {dayLetter(i)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {p.otherLists.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Overline sx={{ mb: 1 }}>{protoCopy.otherLists}</Overline>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {p.otherLists.map((l) => (
              <StudyButton key={l.id} onClick={() => p.onSwitchList(l.id)}>
                {l.name} · {protoCopy.dueCount(l.due)}
              </StudyButton>
            ))}
            {p.hasMultipleLists && p.totalDue > 0 && (
              <StudyButton onClick={p.onTestAll}>{protoCopy.testAll(p.totalDue)}</StudyButton>
            )}
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        <StudyButton onClick={p.onAddWords}>{protoCopy.addWords}</StudyButton>
        {p.hasWords && (
          <StudyButton variant="primary" onClick={p.onPractice}>
            {protoCopy.practice}
          </StudyButton>
        )}
      </Box>
      <SwitcherGap />
    </StudyScreen>
  );
};

const VariantB: VariantModule = { Summary, Empty };
export default VariantB;
