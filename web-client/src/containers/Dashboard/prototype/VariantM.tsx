// PROTOTYPE (#403) headline M, "Session builder": the headline does what the
// tab bar's Study button cannot, which is to choose what kind of session to
// run. Three sizes, and a direction to put first. The Start button names the
// session it will start. The engine already takes a budget and a priority
// direction (readSessionSettings); the prototype does not pass them on yet.
// On a desktop the page is two columns: the builder over the calendar, and the
// chengyu over the five skills. On a phone it is one column. Throwaway.
import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';

import { colors, shadows } from '../../../theme';
import { DIRECTIONS, Direction } from '../../../types/models';
import { DIRECTION_LABELS } from '../../../utils/directions';
import { QUESTIONS_PER_SESSION_MAX } from '../../../utils/sessionSettings';
import { readSessionSettings } from '../../../components/Test/Logic/TestLogic';
import { DashboardVariantProps, ListMenu } from './dashboardShared';
import { Section, summarisePlan } from './headlineShared';
import SkillsWidget from './SkillsWidget';
import CalendarWidget from './CalendarWidget';
import ChengyuWidget from './ChengyuWidget';

export const name = 'Session builder';

type Size = 'quick' | 'usual' | 'all';

const VariantM: React.FC<DashboardVariantProps> = (props) => {
  const {
    words,
    loading,
    error,
    resumeLabel,
    onStart,
    onResume,
    onStartOver,
    onAddWords,
    onRetry,
  } = props;
  const empty = !loading && !error && words.length === 0;
  const [size, setSize] = useState<Size>('usual');
  const [focus, setFocus] = useState<Direction | 'none'>('none');

  const usual = readSessionSettings().budget;
  const budgets: Record<Size, number> = { quick: 10, usual, all: QUESTIONS_PER_SESSION_MAX };
  const plans = useMemo(
    () =>
      (['quick', 'usual', 'all'] as Size[]).reduce(
        (acc, s) => {
          acc[s] = summarisePlan(words, { budget: budgets[s], priority: focus });
          return acc;
        },
        {} as Record<Size, ReturnType<typeof summarisePlan>>,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, focus, usual],
  );
  const chosen = plans[size];
  const nothingDue = !empty && plans.all.questions === 0;

  const sizeLabel: Record<Size, string> = { quick: 'Quick', usual: 'Usual', all: 'Everything' };

  return (
    <Box
      sx={{
        maxWidth: { xs: 560, md: 'none' },
        mx: 'auto',
        pb: { xs: 24, md: 4 },
        textAlign: 'left',
        display: 'grid',
        gap: { xs: 4, md: 3 },
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
        alignItems: 'start',
        // Each widget keeps its own card; the column, not the widget, sets the width.
        '& section > div': { maxWidth: { md: 'none' } },
      }}
    >
      <Column>
        <Box
          sx={{
            order: { xs: 0, md: 0 },
            bgcolor: colors.card,
            boxShadow: shadows.card,
            borderRadius: 3,
            p: { xs: 2, md: 3 },
          }}
        >
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Today</Typography>
            <ListMenu {...props} />
          </Box>

          {loading && <Skeleton variant="rounded" height={150} />}

          {error && (
            <Box sx={{ py: 2 }}>
              <Typography sx={{ color: colors.error }}>Could not load</Typography>
              <Button onClick={onRetry} sx={{ color: colors.primaryDark, px: 0 }}>
                Try again
              </Button>
            </Box>
          )}

          {empty && (
            <Button
              onClick={onAddWords}
              variant="contained"
              fullWidth
              size="large"
              sx={{
                bgcolor: colors.primaryDark,
                color: colors.white,
                py: 1.5,
                '&:hover': { bgcolor: colors.primaryDarkHover },
              }}
            >
              Add words
            </Button>
          )}

          {/* An unfinished session comes before any new choice. */}
          {!loading && !error && !empty && resumeLabel && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                mb: 2,
                borderRadius: 2,
                bgcolor: colors.successSurface,
              }}
            >
              <Typography sx={{ flex: 1, fontWeight: 600 }}>Unfinished · {resumeLabel}</Typography>
              <Button onClick={onStartOver} sx={{ color: colors.textSecondary }}>
                Start over
              </Button>
              <Button
                onClick={onResume}
                variant="contained"
                sx={{
                  bgcolor: colors.primaryDark,
                  color: colors.white,
                  '&:hover': { bgcolor: colors.primaryDarkHover },
                }}
              >
                Resume
              </Button>
            </Box>
          )}

          {!loading && !error && !empty && !resumeLabel && (
            <>
              {nothingDue ? (
                <Typography sx={{ py: 2, color: colors.textSecondary }}>
                  Nothing due today
                </Typography>
              ) : (
                <>
                  {/* Size. */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {(['quick', 'usual', 'all'] as Size[]).map((s) => {
                      const on = s === size;
                      return (
                        <ButtonBase
                          key={s}
                          onClick={() => setSize(s)}
                          sx={{
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            p: 1.5,
                            borderRadius: 2,
                            fontFamily: 'inherit',
                            border: `1.5px solid ${on ? colors.primaryDark : colors.borderStrong}`,
                            bgcolor: on ? colors.successSurface : 'transparent',
                          }}
                        >
                          <Typography sx={{ fontWeight: 700 }}>{sizeLabel[s]}</Typography>
                          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                            {plans[s].time}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {plans[s].questions} questions
                          </Typography>
                        </ButtonBase>
                      );
                    })}
                  </Box>

                  {/* Focus. */}
                  <Typography variant="body2" sx={{ fontWeight: 600, mt: 2, mb: 0.75 }}>
                    Ask first
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.75,
                      overflowX: { xs: 'auto', md: 'visible' },
                      flexWrap: { md: 'wrap' },
                      scrollbarWidth: 'none',
                      mx: { xs: -2, md: 0 },
                      px: { xs: 2, md: 0 },
                    }}
                  >
                    {(['none', ...DIRECTIONS] as (Direction | 'none')[]).map((d) => {
                      const on = d === focus;
                      return (
                        <ButtonBase
                          key={d}
                          onClick={() => setFocus(d)}
                          sx={{
                            flex: '0 0 auto',
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 999,
                            fontFamily: 'inherit',
                            fontSize: 13,
                            border: `1px solid ${on ? colors.text : colors.borderStrong}`,
                            bgcolor: on ? colors.text : 'transparent',
                            color: on ? colors.white : colors.text,
                          }}
                        >
                          {d === 'none' ? 'Mixed' : DIRECTION_LABELS[d]}
                        </ButtonBase>
                      );
                    })}
                  </Box>
                </>
              )}

              <Button
                onClick={onStart}
                variant="contained"
                fullWidth
                size="large"
                sx={{
                  mt: 2,
                  py: 1.5,
                  fontSize: 17,
                  bgcolor: colors.primaryDark,
                  color: colors.white,
                  '&:hover': { bgcolor: colors.primaryDarkHover },
                }}
              >
                {nothingDue
                  ? 'Practise anyway'
                  : `Start · ${chosen.questions} questions · ${chosen.time}`}
              </Button>
              {!nothingDue && chosen.newWords > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
                >
                  Includes {chosen.newWords} new words
                </Typography>
              )}
            </>
          )}
        </Box>

        <Tile order={3} title="Calendar">
          <CalendarWidget {...props} bare />
        </Tile>
      </Column>
      <Column>
        <Tile order={1} title="Chengyu">
          <ChengyuWidget {...props} bare />
        </Tile>
        <Tile order={2} title="Five skills">
          <SkillsWidget {...props} bare />
        </Tile>
      </Column>
    </Box>
  );
};

/** A desktop column. On a phone its children join the one column, in their order. */
const Column: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: { xs: 'contents', md: 'flex' },
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
    }}
  >
    {children}
  </Box>
);

/** A widget under a label. */
const Tile: React.FC<{ order: number; title: string; children: React.ReactNode }> = ({
  order,
  title,
  children,
}) => (
  <Box sx={{ order: { xs: order, md: 0 }, minWidth: 0 }}>
    <Section title={title}>{children}</Section>
  </Box>
);

export default VariantM;
