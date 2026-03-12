import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Button from '../Buttons/Button/Button';
import { WordList } from '../../../types/models';
import { ListStats } from '../../../types/store';

interface ListSelectorProps {
  lists: WordList[];
  activeListId: string;
  listStats: Record<string, ListStats>;
  onSwitchList: (listId: string) => void;
  onCreateList: (name: string) => void;
  onRenameList: (listId: string, newName: string) => void;
  onDeleteList: (listId: string) => void;
  readOnly?: boolean;
  alwaysShow?: boolean;
}

const ListSelector: React.FC<ListSelectorProps> = ({
  lists,
  activeListId,
  listStats,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
  readOnly,
  alwaysShow,
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

  if (!alwaysShow && safeLists.filter((l) => l.id !== 'default').length === 0) return null;

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
          <InputLabel
            id="list-selector-label"
            sx={{ '&, &.MuiInputLabel-shrink': { color: 'text.primary' } }}
          >
            Active list
          </InputLabel>
          <Select
            labelId="list-selector-label"
            label="Active list"
            value={activeListId}
            onChange={handleListChange}
            data-testid="list-selector"
            renderValue={(selected) => {
              const list = safeLists.find((l) => l.id === selected);
              return list?.name ?? selected;
            }}
          >
            {safeLists.map((list) => {
              const stats = listStats[list.id];
              const dueCount = stats?.due ?? 0;
              return (
                <MenuItem
                  key={list.id}
                  value={list.id}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}
                >
                  <span>{list.name}</span>
                  {stats && (
                    <Chip
                      label={`${dueCount} due`}
                      size="small"
                      color={dueCount > 0 ? 'primary' : 'default'}
                      variant={dueCount > 0 ? 'filled' : 'outlined'}
                      sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        {!readOnly && (
          <>
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
          </>
        )}
      </Box>

      {/* Create List Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth>
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
            InputLabelProps={{
              sx: { '&, &.MuiInputLabel-shrink': { color: 'text.primary' } },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="ghost" clicked={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button clicked={handleCreate} disabled={!newListName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename List Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} fullWidth>
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
            InputLabelProps={{
              sx: { '&, &.MuiInputLabel-shrink': { color: 'text.primary' } },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="ghost" clicked={() => setRenameDialogOpen(false)}>
            Cancel
          </Button>
          <Button clicked={handleRename} disabled={!renameListName.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete List Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth>
        <DialogTitle>Delete List</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{activeList?.name}&rdquo;? All words in this list
            will be permanently removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="ghost" clicked={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="secondary" clicked={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ListSelector;
