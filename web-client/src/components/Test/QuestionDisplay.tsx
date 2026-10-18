import React from 'react';
import { Box } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
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

// Hanzi are the focus of the card, so they are as large as the card allows: a
// four-character chengyu must still fit on one line of a phone-width card.
function hanziFontSize(text: string): string {
  if (text.length <= 2) return '5.5rem';
  if (text.length === 3) return '4.5rem';
  if (text.length === 4) return '3.5rem';
  return '2.5rem';
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
            minHeight: '100px',
          }}
        >
          {synthLoading ? (
            <Spinner style={{ overflow: 'hidden', margin: '0 auto' }} />
          ) : (
            <PictureButton
              type="secondary"
              src={speakerPic}
              aria-label={copy.test.playPronunciation}
              clicked={() => chosenCharacter && onSpeak(chosenCharacter)}
            />
          )}
        </div>
        {showQuestionPinyin ? (
          <p lang="zh-Latn" style={{ color: colors.text, margin: '4px 0' }}>
            {question}
          </p>
        ) : null}
        <Box
          component="button"
          onClick={onToggleShowPinyin}
          aria-pressed={showQuestionPinyin}
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
          {showQuestionPinyin ? copy.test.hidePinyin : copy.test.showPinyin}
        </Box>
      </>
    );
  }

  const langAttr =
    questionCategory === 'character' ? 'zh' : questionCategory === 'pinyin' ? 'zh-Latn' : undefined;
  if (questionCategory === 'character' && typeof questionText === 'string') {
    return (
      <h2
        lang={langAttr}
        style={{
          fontFamily: fonts.hanzi,
          fontWeight: 400,
          fontSize: hanziFontSize(questionText),
          lineHeight: 1.1,
          letterSpacing: '0.06em',
        }}
      >
        {questionText}
      </h2>
    );
  }
  return <h2 lang={langAttr}>{questionText}</h2>;
};

export default React.memo(QuestionDisplay);
