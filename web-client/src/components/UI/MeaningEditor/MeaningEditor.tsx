import React, { useState, useRef, useEffect } from 'react';
import { Box, Chip, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { parseMeanings, joinMeanings } from '../../../utils/meaningUtils';

interface MeaningEditorProps {
  value: string;
  onChange?: (value: string) => void;
  size?: 'small' | 'medium';
  readOnly?: boolean;
}

const MeaningEditor: React.FC<MeaningEditorProps> = ({
  value,
  onChange,
  size = 'small',
  readOnly = false,
}) => {
  const meanings = parseMeanings(value);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addingText, setAddingText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingIndex]);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const emitChange = (updated: string[]) => {
    if (onChange === undefined) {
      return;
    }
    onChange(joinMeanings(updated));
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingText(meanings[index]);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingText.trim();
    const updated = [...meanings];
    if (trimmed.length === 0) {
      updated.splice(editingIndex, 1);
    } else {
      updated[editingIndex] = trimmed;
    }
    setEditingIndex(null);
    setEditingText('');
    if (updated.length > 0) {
      emitChange(updated);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const deleteMeaning = (index: number) => {
    const updated = meanings.filter((_, i) => i !== index);
    if (updated.length > 0) {
      emitChange(updated);
    }
  };

  const saveAdd = () => {
    const trimmed = addingText.trim();
    if (trimmed.length > 0) {
      emitChange([...meanings, trimmed]);
    }
    setIsAdding(false);
    setAddingText('');
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setAddingText('');
  };

  const chipSize = size === 'small' ? 'small' : 'medium';

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', justifyContent: readOnly ? 'center' : undefined, width: '100%' }}>
      {meanings.map((meaning, index) =>
        !readOnly && editingIndex === index ? (
          <TextField
            key={index}
            inputRef={inputRef}
            size="small"
            variant="outlined"
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            onBlur={saveEdit}
            sx={{
              '& input': { fontSize: '0.85rem', py: 0.5, px: 1 },
              minWidth: 80,
              maxWidth: 250,
            }}
          />
        ) : (
          <Chip
            key={index}
            label={meaning}
            size={chipSize}
            variant="outlined"
            onClick={readOnly ? undefined : () => startEditing(index)}
            onDelete={!readOnly && meanings.length > 1 ? () => deleteMeaning(index) : undefined}
            sx={{
              cursor: readOnly ? 'default' : 'pointer',
              maxWidth: '100%',
              height: 'auto',
              '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.3, py: 0.75 },
            }}
          />
        )
      )}
      {!readOnly && (
        isAdding ? (
          <TextField
            inputRef={addInputRef}
            size="small"
            variant="outlined"
            placeholder="New meaning"
            value={addingText}
            onChange={(e) => setAddingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveAdd();
              } else if (e.key === 'Escape') {
                cancelAdd();
              }
            }}
            onBlur={saveAdd}
            sx={{
              '& input': { fontSize: '0.85rem', py: 0.5, px: 1 },
              minWidth: 80,
              maxWidth: 250,
            }}
          />
        ) : (
          <Chip
            icon={<AddIcon />}
            label="Add"
            size={chipSize}
            variant="outlined"
            onClick={() => setIsAdding(true)}
            sx={{ cursor: 'pointer', borderStyle: 'dashed' }}
          />
        )
      )}
    </Box>
  );
};

export default MeaningEditor;
