import React, { useCallback, useEffect, useState } from 'react';

import Button from '../../UI/Buttons/Button/Button';
import NewWord from './NewWord/NewWord';

import classes from './NewWords.module.css';
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
    [onChangeWord, startTest, wordIndex, words.length]
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  return (
    <div className={classes.NewWords}>
      <h2>New Words</h2>
      <h4>Click on a character to see information</h4>
      <NewWord word={words[wordIndex]} isDemo={isDemo}></NewWord>
      <Button clicked={() => onChangeWord(-1)} disabled={wordIndex < 1}>
        Previous Word
      </Button>
      <Button
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
    </div>
  );
};

export default NewWords;
