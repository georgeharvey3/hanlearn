// PROTOTYPE (#414) variant A, "Score first": the score is the hero of the
// summary, on the study card, with one bar split into Known, Nearly and Not
// known. Only the missed words list below it; the rest wait behind a toggle.
// The empty state is one card with a resting seal and the next due count.
// Throwaway.
import React, { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import StudyTop from '../../Study/StudyTop';
import StudyScreen from '../../Study/StudyScreen';
import { Overline, StudyButton, StudyCard, hanziSx } from '../../Study/parts';
import { colors } from '../../../../theme';
import { DIRECTION_LABELS } from '../../../../utils/directions';
import {
  EmptyProps,
  SummaryProps,
  SummaryRow,
  VariantModule,
  firstUpcoming,
  SwitcherGap,
  protoCopy,
  resultFill,
  resultInk,
  resultLabel,
  tally,
} from './shared';

const Row: React.FC<{ row: SummaryRow }> = ({ row }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      py: 1.25,
      borderBottom: `1px solid ${colors.divider}`,
    }}
  >
    <Box lang="zh" sx={hanziSx(30, { minWidth: 64, textAlign: 'left' })}>
      {row.char}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
      <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
        {row.pinyin}
      </Box>
      <Box
        sx={{
          fontSize: 13,
          color: colors.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row.meaning} · {DIRECTION_LABELS[row.direction]}
      </Box>
    </Box>
    <Box sx={{ fontSize: 13, fontWeight: 600, color: resultInk[row.result], flex: 'none' }}>
      {resultLabel[row.result]}
    </Box>
  </Box>
);

const Summary: React.FC<SummaryProps> = ({ rows, practiceMode, onHome, onPracticeMissed }) => {
  const [showAll, setShowAll] = useState(false);
  const t = tally(rows);
  const missed = rows.filter((r) => r.result !== 'pass');

  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageDone} done={t.total} total={t.total} onEnd={onHome} />
      <StudyCard sx={{ mt: 3, py: 4 }} seal={false}>
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
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          {(['pass', 'lapse', 'fail'] as const).map((r) => (
            <Box key={r} sx={{ color: resultInk[r], fontWeight: 600 }}>
              {t[r]} {resultLabel[r]}
            </Box>
          ))}
        </Box>
        {practiceMode && (
          <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{protoCopy.practiceNote}</Box>
        )}
      </StudyCard>

      <Box sx={{ mt: 3 }}>
        {missed.length > 0 ? (
          <>
            <Overline sx={{ mb: 0.5 }}>{protoCopy.lookAgain}</Overline>
            {missed.map((row, i) => (
              <Row key={i} row={row} />
            ))}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', color: colors.success, fontWeight: 600 }}>
            {protoCopy.allKnown}
          </Box>
        )}
        <ButtonBase
          onClick={() => setShowAll((s) => !s)}
          aria-expanded={showAll}
          sx={{
            mt: 1.5,
            height: 44,
            gap: 0.5,
            fontSize: 15,
            fontWeight: 600,
            color: colors.primaryDark,
          }}
        >
          {showAll ? protoCopy.hideAnswers : protoCopy.allAnswers}
          <ExpandMoreRoundedIcon
            sx={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
          />
        </ButtonBase>
        {showAll &&
          rows.filter((r) => r.result === 'pass').map((row, i) => <Row key={i} row={row} />)}
      </Box>

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {missed.length > 0 && (
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

const Empty: React.FC<EmptyProps> = (p) => {
  const next = firstUpcoming(p.upcoming);
  return (
    <StudyScreen>
      <StudyTop stage={protoCopy.stageTest} done={0} total={0} onEnd={p.onHome} />
      <StudyCard sx={{ mt: 3, py: 5 }} seal={false}>
        <Box
          aria-hidden="true"
          sx={{
            ...hanziSx(56),
            width: 88,
            height: 88,
            boxSizing: 'border-box',
            border: `3px solid ${colors.primaryLight}`,
            borderRadius: '6px',
            color: colors.primaryLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          休
        </Box>
        <Box sx={{ fontSize: 22, fontWeight: 600, mt: 1 }}>
          {p.hasWords ? protoCopy.nothingDueIn(p.listName) : protoCopy.noWords}
        </Box>
        {p.hasWords && (
          <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
            {next ? protoCopy.nextDue(next.n, next.day) : protoCopy.nothingThisWeek}
          </Box>
        )}
      </StudyCard>

      {p.otherLists.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Overline sx={{ mb: 0.5 }}>{protoCopy.otherLists}</Overline>
          {p.otherLists.map((l) => (
            <ButtonBase
              key={l.id}
              onClick={() => p.onSwitchList(l.id)}
              sx={{
                width: '100%',
                justifyContent: 'space-between',
                py: 1.5,
                fontSize: 16,
                borderBottom: `1px solid ${colors.divider}`,
              }}
            >
              <span>{l.name}</span>
              <Box component="span" sx={{ color: colors.primaryDark, fontWeight: 600 }}>
                {protoCopy.dueCount(l.due)}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {p.hasMultipleLists && p.totalDue > 0 && (
          <StudyButton variant="primary" onClick={p.onTestAll}>
            {protoCopy.testAll(p.totalDue)}
          </StudyButton>
        )}
        {p.hasWords && (
          <StudyButton
            variant={p.hasMultipleLists && p.totalDue > 0 ? 'ghost' : 'primary'}
            onClick={p.onPractice}
          >
            {protoCopy.practice}
          </StudyButton>
        )}
        <StudyButton variant={p.hasWords ? 'ghost' : 'primary'} onClick={p.onAddWords}>
          {protoCopy.addWords}
        </StudyButton>
      </Box>
      <SwitcherGap />
    </StudyScreen>
  );
};

const VariantA: VariantModule = { Summary, Empty };
export default VariantA;
