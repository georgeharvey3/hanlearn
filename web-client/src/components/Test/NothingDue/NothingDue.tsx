import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';
import { Overline, StudyButton, StudyCard, hanziSx } from '../Study/parts';
import { NextDue } from '../TestSummary/summary';

export interface OtherList {
  id: string;
  name: string;
  due: number;
}

interface NothingDueProps {
  /** The list the session ran on: a list's name, or "All lists". */
  listName: string;
  hasWords: boolean;
  /** The first day ahead with words due, or null for none this week. */
  next: NextDue | null;
  /** The other lists with words due. */
  otherLists: OtherList[];
  /** Due across all lists, when "Test all lists" applies; 0 hides it. */
  totalDue: number;
  onSwitchList: (id: string) => void;
  onTestAll: () => void;
  onPractice: () => void;
  onAddWords: () => void;
  onHome: () => void;
}

/**
 * The Test page when no word is due. It shows counts only, never a due word: a
 * word seen here just before the test asks it primes the answer.
 */
const NothingDue: React.FC<NothingDueProps> = ({
  listName,
  hasWords,
  next,
  otherLists,
  totalDue,
  onSwitchList,
  onTestAll,
  onPractice,
  onAddWords,
  onHome,
}) => {
  const testAll = totalDue > 0;
  return (
    <StudyScreen>
      <StudyTop stage={copy.study.stageTest} done={0} total={0} onEnd={onHome} />
      <StudyCard sx={{ mt: 3, py: 5 }}>
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
          {copy.nothingDue.seal}
        </Box>
        <Box component="h1" sx={{ m: 0, mt: 1, fontSize: 22, fontWeight: 600 }}>
          {hasWords ? copy.nothingDue.title(listName) : copy.nothingDue.noWords}
        </Box>
        {hasWords && (
          <Box component="p" sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}>
            {next
              ? copy.nothingDue.nextDue(next.count, next.days)
              : copy.nothingDue.nothingThisWeek}
          </Box>
        )}
      </StudyCard>

      {otherLists.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Overline sx={{ mb: 0.5 }}>{copy.nothingDue.otherLists}</Overline>
          {otherLists.map((list) => (
            <ButtonBase
              key={list.id}
              onClick={() => onSwitchList(list.id)}
              sx={{
                width: '100%',
                height: 52,
                justifyContent: 'space-between',
                fontFamily: 'inherit',
                fontSize: 16,
                color: colors.text,
                borderBottom: `1px solid ${colors.divider}`,
              }}
            >
              <span>{list.name}</span>
              <Box component="span" sx={{ fontWeight: 600, color: colors.primaryDark }}>
                {copy.nothingDue.due(list.due)}
              </Box>
            </ButtonBase>
          ))}
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 24 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {testAll && (
          <StudyButton variant="primary" onClick={onTestAll}>
            {copy.nothingDue.testAll(totalDue)}
          </StudyButton>
        )}
        {hasWords && (
          <StudyButton variant={testAll ? 'ghost' : 'primary'} onClick={onPractice}>
            {copy.nothingDue.practice}
          </StudyButton>
        )}
        <StudyButton variant={hasWords ? 'ghost' : 'primary'} onClick={onAddWords}>
          {copy.nothingDue.addWords}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default NothingDue;
