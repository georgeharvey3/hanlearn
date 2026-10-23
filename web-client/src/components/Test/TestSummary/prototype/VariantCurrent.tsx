// PROTOTYPE (#414): the current summary and empty state behind the same props
// as the variants, so that a ?state= preview can show them with sample data
// too. The empty state is a copy of the one inline in TestWords. Throwaway.
import React from 'react';
import { Box, Chip, Typography } from '@mui/material';

import TestSummary from '../TestSummary';
import Button from '../../../UI/Buttons/Button/Button';
import { EmptyProps, SummaryProps, VariantModule } from './shared';

const Summary: React.FC<SummaryProps> = ({ rows }) => (
  <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 4 }}>
    <TestSummary
      scores={rows.map((r) => ({ char: r.char, direction: r.direction, result: r.result }))}
    />
  </Box>
);

const Empty: React.FC<EmptyProps> = (p) => (
  <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 8, textAlign: 'center' }}>
    <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
      No words due in &ldquo;{p.listName}&rdquo;
    </Typography>

    {!p.isAllLists && p.otherLists.length > 0 && (
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Other lists with words due:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
          {p.otherLists.map((l) => (
            <Chip
              key={l.id}
              label={`${l.name} (${l.due} due)`}
              onClick={() => p.onSwitchList(l.id)}
              color="primary"
              variant="outlined"
              clickable
            />
          ))}
        </Box>
      </Box>
    )}

    {!p.isAllLists && p.hasMultipleLists && p.totalDue > 0 && (
      <Box sx={{ mb: 3 }}>
        <Chip
          label={`Test All Lists (${p.totalDue} due)`}
          onClick={p.onTestAll}
          color="primary"
          variant="filled"
          clickable
        />
      </Box>
    )}

    {(p.isAllLists || p.otherLists.length === 0) && (
      <Typography variant="body2" sx={{ mb: 3, color: 'text.disabled' }}>
        No words due in any list
      </Typography>
    )}

    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
      <Button clicked={p.onAddWords}>Add Words</Button>
      {p.hasWords && (
        <Button type="ghost" clicked={p.onPractice}>
          Practice
        </Button>
      )}
    </Box>
  </Box>
);

const VariantCurrent: VariantModule = { Summary, Empty };
export default VariantCurrent;
