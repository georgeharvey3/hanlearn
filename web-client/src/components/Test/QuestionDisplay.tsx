import React from 'react';
import { Box } from '@mui/material';

import { colors } from '../../theme';
import PictureButton from '../UI/Buttons/PictureButton/PictureButton';
import Spinner from '../UI/Spinner/Spinner';

import speakerPic from '../../assets/images/speaker.png';

interface QuestionDisplayProps {
  questionCategory: string | null;
  question: string | string[] | null;
  useSound: boolean;
  showPinyin: boolean;
  showQuestionPinyin: boolean;
  synthLoading: boolean;
  chosenCharacter: string | null;
  onSpeak: (word: string) => void;
  onToggleShowPinyin: () => void;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  questionCategory,
  question,
  useSound,
  showPinyin,
  showQuestionPinyin,
  synthLoading,
  chosenCharacter,
  onSpeak,
  onToggleShowPinyin,
}) => {
  const questionText =
    questionCategory === 'meaning' && Array.isArray(question) ? question.join(' / ') : question;

  if (questionCategory === 'pinyin' && useSound && !showPinyin) {
    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            height: '100px',
          }}
        >
          {synthLoading ? (
            <Spinner style={{ overflow: 'hidden', margin: '0 auto' }} />
          ) : (
            <PictureButton
              type="secondary"
              src={speakerPic}
              aria-label="Play pronunciation"
              clicked={() => chosenCharacter && onSpeak(chosenCharacter)}
            />
          )}
        </div>
        {showQuestionPinyin ? (
          <p style={{ color: colors.text, margin: '4px 0' }}>{question}</p>
        ) : null}
        <Box
          component="button"
          onClick={onToggleShowPinyin}
          sx={{
            bgcolor: 'transparent',
            color: 'primary.dark',
            textDecoration: 'underline',
            border: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            fontSize: '0.85rem',
            mt: 0.5,
            '&:hover': { color: 'primary.light' },
          }}
        >
          {showQuestionPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
        </Box>
      </>
    );
  }

  return <h2>{questionText}</h2>;
};

export default React.memo(QuestionDisplay);
