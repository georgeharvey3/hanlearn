import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import MuiButton from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { WordList } from '../../../types/models';

interface ListSelectorProps {
  lists: WordList[];
  activeListId: string;
  onSwitchList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onRenameList: (listId: string, newName: string) => void;
  onDeleteList: (listId: string) => void;
}

const ListSelector: React.FC<ListSelectorProps> = ({
  lists,
  activeListId,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renameListName, setRenameListName] = useState('');

  const safeLists = lists || [];
  const activeList = safeLists.find((l) => l.id === activeListId);

  const handleListChange = useCallback(
    (event: SelectChangeEvent) => {
      onSwitchList(event.target.value);
    },
    [onSwitchList],
  );

  const handleCreate = useCallback(() => {
    if (newListName.trim()) {
      onCreateList(newListName.trim());
      setNewListName('');
      setCreateDialogOpen(false);
    }
  }, [newListName, onCreateList]);

  const handleRename = useCallback(() => {
    if (renameListName.trim()) {
      onRenameList(activeListId, renameListName.trim());
      setRenameListName('');
      setRenameDialogOpen(false);
    }
  }, [renameListName, activeListId, onRenameList]);

  const handleDelete = useCallback(() => {
    onDeleteList(activeListId);
    setDeleteDialogOpen(false);
  }, [activeListId, onDeleteList]);

  const openRenameDialog = useCallback(() => {
    setRenameListName(activeList?.name || '');
    setRenameDialogOpen(true);
  }, [activeList]);

  if (safeLists.length === 0) return null;

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 2,
          justifyContent: 'center',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select value={activeListId} onChange={handleListChange} data-testid="list-selector">
            {safeLists.map((list) => (
              <MenuItem key={list.id} value={list.id}>
                {list.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          size="small"
          onClick={() => setCreateDialogOpen(true)}
          aria-label="Create new list"
        >
          <AddIcon />
        </IconButton>
        {activeListId !== 'default' && (
          <>
            <IconButton size="small" onClick={openRenameDialog} aria-label="Rename list">
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setDeleteDialogOpen(true)}
              aria-label="Delete list"
            >
              <DeleteIcon />
            </IconButton>
          </>
        )}
      </Box>

      {/* Create List Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create New List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="List name"
            fullWidth
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            inputProps={{ maxLength: 50 }}
          />
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setCreateDialogOpen(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleCreate} disabled={!newListName.trim()}>
            Create
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Rename List Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="List name"
            fullWidth
            value={renameListName}
            onChange={(e) => setRenameListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
            inputProps={{ maxLength: 50 }}
          />
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setRenameDialogOpen(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleRename} disabled={!renameListName.trim()}>
            Rename
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Delete List Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete List</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{activeList?.name}&rdquo;? All words in this list
            will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setDeleteDialogOpen(false)}>Cancel</MuiButton>
          <MuiButton onClick={handleDelete} color="error">
            Delete
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ListSelector;
