import React from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Box from '@mui/material/Box';

import Button from '../../UI/Buttons/Button/Button';
import ListSelector from '../../UI/ListSelector/ListSelector';
import { WordList } from '../../../types/models';
import { ListStats } from '../../../types/store';

interface AccountSummaryProps {
  numDue?: number;
  numTot?: number;
  testClicked?: () => void;
  addWordsClicked?: () => void;
  loading?: boolean;
  activeListName?: string;
  lists: WordList[];
  activeListId: string;
  listStats: Record<string, ListStats>;
  onSwitchList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onRenameList: (listId: string, newName: string) => void;
  onDeleteList: (listId: string) => void;
}

const AccountSummary: React.FC<AccountSummaryProps> = (props) => (
  <Paper sx={{ width: '95%', mx: 'auto', p: 3, textAlign: 'center' }}>
    <Box>
      <ListSelector
        lists={props.lists}
        activeListId={props.activeListId}
        listStats={props.listStats}
        onSwitchList={props.onSwitchList}
        onCreateList={props.onCreateList}
        onRenameList={props.onRenameList}
        onDeleteList={props.onDeleteList}
        readOnly
      />
    </Box>
    {props.loading ? (
      <Skeleton variant="text" width="60%" sx={{ mx: 'auto', fontSize: '1.5rem', mb: 1 }} />
    ) : props.numTot === 0 ? (
      <>
        <Typography variant="h5" sx={{ color: 'text.primary' }}>
          No words in your list yet. Start by adding some words!
        </Typography>
        <Button type="primary" clicked={props.addWordsClicked}>
          Add Words
        </Button>
      </>
    ) : (
      <>
        <Typography variant="h5" sx={{ color: 'text.primary' }}>
          {props.numDue}/{props.numTot} words due for testing
        </Typography>
        <Button
          disabled={props.loading || props.numDue === 0}
          type="primary"
          clicked={props.testClicked}
        >
          Test
        </Button>
      </>
    )}
  </Paper>
);

export default AccountSummary;
