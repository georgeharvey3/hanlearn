import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Button from '../UI/Buttons/Button/Button';
import { WordList } from '../../types/models';

interface MoveToListDialogProps {
  open: boolean;
  lists: WordList[];
  currentListId?: string;
  wordLabel: string;
  onClose: () => void;
  onSelect: (listId: string) => void;
}

const MoveToListDialog: React.FC<MoveToListDialogProps> = ({
  open,
  lists,
  currentListId,
  wordLabel,
  onClose,
  onSelect,
}) => {
  const targets = lists.filter((l) => l.id !== currentListId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Move {wordLabel ? `"${wordLabel}"` : 'word'} to…</DialogTitle>
      <DialogContent dividers>
        {targets.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>
            No other lists available. Create another list first.
          </Typography>
        ) : (
          <List disablePadding>
            {targets.map((list) => (
              <ListItemButton
                key={list.id}
                onClick={() => onSelect(list.id)}
                aria-label={`Move to ${list.name}`}
              >
                <ListItemText primary={list.name} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button type="ghost" clicked={onClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoveToListDialog;
