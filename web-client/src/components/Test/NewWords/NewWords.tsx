import React, { useCallback, useEffect, useState } from 'react';

import { Box, Typography } from '@mui/material';

import Button from '../../UI/Buttons/Button/Button';
import NewWord from './NewWord/NewWord';

import { Word } from '../../../types/models';

interface NewWordsProps {
  words: Word[];
  isDemo?: boolean;
  startTest?: () => void;
}

const NewWords: React.FC<NewWordsProps> = ({ words, isDemo, startTest }) => {
  const [wordIndex, setWordIndex] = useState(0);

  const onChangeWord = useCallback((direction: number): void => {
    setWordIndex((prevState) => prevState + direction);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        if (wordIndex > 0) {
          onChangeWord(-1);
        }
      }

      if (event.key === 'ArrowRight') {
        if (wordIndex < words.length - 1) {
          onChangeWord(1);
        } else {
          startTest?.();
        }
      }
    },
    [onChangeWord, startTest, wordIndex, words.length],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  return (
    <Box
      sx={{
        width: '90%',
        maxWidth: 400,
        textAlign: 'center',
        mx: 'auto',
        py: '30px',
        color: 'text.primary',
      }}
    >
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
        New Words
      </Typography>
      <Typography variant="subtitle1" component="h4" sx={{ color: 'text.secondary', mb: 2 }}>
        Click on a character to see information
      </Typography>
      <NewWord word={words[wordIndex]} isDemo={isDemo}></NewWord>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
        <Button type="ghost" clicked={() => onChangeWord(-1)} disabled={wordIndex < 1}>
          Previous Word
        </Button>
        <Button
          type="primary"
          clicked={() => {
            if (wordIndex < words.length - 1) {
              onChangeWord(1);
            } else {
              startTest?.();
            }
          }}
        >
          {wordIndex < words.length - 1 ? 'Next Word' : 'Start Test'}
        </Button>
      </Box>
    </Box>
  );
};

export default NewWords;
