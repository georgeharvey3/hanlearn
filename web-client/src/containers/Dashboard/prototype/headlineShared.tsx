// PROTOTYPE (#403): what the headline variants M to P share. The widgets the
// owner chose (skills, calendar, chengyu) sit under every headline, so the
// variants differ only in the headline. And a session plan that a headline can
// shape, from the engine's own planSession. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { colors } from '../../../theme';
import { Direction, Word } from '../../../types/models';
import { planSession, readSessionSettings } from '../../../components/Test/Logic/TestLogic';
import { estimatePlannedTime, formatTestTime } from '../../../utils/estimateTestTime';
import { DashboardVariantProps } from './dashboardShared';
import SkillsWidget from './SkillsWidget';
import CalendarWidget from './CalendarWidget';
import ChengyuWidget from './ChengyuWidget';

export interface PlanOptions {
  budget?: number;
  priority?: Direction | 'none';
  onlyPriority?: boolean;
  practiceMode?: boolean;
}

export interface PlanSummary {
  questions: number;
  words: number;
  newWords: number;
  time: string;
}

/** The session these options would start: the engine's plan, counted. */
export const summarisePlan = (words: Word[], options: PlanOptions = {}): PlanSummary => {
  const base = readSessionSettings();
  const plan = planSession(words, {
    ...base,
    budget: options.budget ?? base.budget,
    priority: options.priority ?? base.priority,
    onlyPriority: options.onlyPriority ?? base.onlyPriority,
    practiceMode: options.practiceMode ?? false,
  });
  const seconds = estimatePlannedTime(plan, {
    newWordsEnabled: localStorage.getItem('newWords') !== 'false',
    sentenceReadEnabled: localStorage.getItem('sentenceRead') !== 'false',
    sentenceWriteEnabled: localStorage.getItem('sentenceWrite') !== 'false',
    sentenceStagesForAllWords: localStorage.getItem('sentenceStagesForAllWords') === 'true',
  });
  return {
    questions: plan.queue.length,
    words: new Set(plan.queue.map((q) => q.index)).size,
    newWords: plan.newWords.length,
    time: formatTestTime(seconds),
  };
};

type Widget = 'skills' | 'calendar' | 'chengyu';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box component="section">
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: colors.textSecondary,
        letterSpacing: '0.1em',
        mb: 1,
        textTransform: 'uppercase',
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

/** The chosen widgets, in one order, under any headline. */
export const WidgetStack: React.FC<DashboardVariantProps & { omit?: Widget[] }> = ({
  omit = [],
  ...props
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 4 }}>
    {!omit.includes('chengyu') && (
      <Section title="Chengyu">
        <ChengyuWidget {...props} bare />
      </Section>
    )}
    {!omit.includes('skills') && (
      <Section title="Five skills">
        <SkillsWidget {...props} bare />
      </Section>
    )}
    {!omit.includes('calendar') && (
      <Section title="Calendar">
        <CalendarWidget {...props} bare />
      </Section>
    )}
  </Box>
);
