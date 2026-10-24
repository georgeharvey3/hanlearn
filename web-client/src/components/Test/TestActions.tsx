import React from 'react';
import { Box, ButtonBase } from '@mui/material';

import { TestState } from './types';
import { DirectionResult } from '../../types/models';
import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { ButtonSpinner, StudyButton } from './Study/parts';
import { answerQuizType } from './answerQuizType';
import { fail } from './constants';

interface TestActionsProps {
  state: TestState;
  onIDontKnow: () => void;
  onHint: () => void;
  onShowAnswer: () => void;
  onCorrectAnswer: () => void;
  onNearlyKnew: () => void;
  onSubmitAnswer: () => void;
  onContinue: () => void;
}

const gradeTone: Record<DirectionResult, { ink: string; surface: string }> = {
  fail: { ink: colors.primaryLight, surface: colors.errorSurface },
  lapse: { ink: colors.warningText, surface: colors.warningSurface },
  pass: { ink: colors.primaryDark, surface: colors.successSurface },
};

/** One of the three flashcard grades. */
const GradeButton: React.FC<{
  grade: DirectionResult;
  pressed: DirectionResult | null;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ grade, pressed, onClick, children }) => {
  const { ink, surface } = gradeTone[grade];
  const isPressed = pressed === grade;
  // A grade is final until the next question, so the two the learner did not
  // press switch off.
  const off = pressed !== null && !isPressed;
  const filled = grade === 'pass';
  return (
    <ButtonBase
      onClick={onClick}
      disabled={off}
      aria-pressed={isPressed}
      sx={{
        flex: 1,
        height: 56,
        borderRadius: 1,
        fontFamily: fonts.body,
        fontSize: 16,
        fontWeight: 600,
        pointerEvents: pressed !== null ? 'none' : 'auto',
        ...(off
          ? filled
            ? { bgcolor: colors.divider, color: colors.white }
            : {
                border: `1px solid ${colors.divider}`,
                bgcolor: colors.card,
                color: colors.disabledText,
              }
          : isPressed
            ? { border: `2px solid ${ink}`, bgcolor: surface, color: ink }
            : filled
              ? {
                  bgcolor: ink,
                  color: colors.white,
                  '&:hover': { bgcolor: colors.primaryDarkHover },
                }
              : { border: `1px solid ${ink}`, bgcolor: colors.card, color: ink }),
      }}
    >
      {children}
    </ButtonBase>
  );
};

/**
 * The buttons at the foot of a question: the hint and "I don't know", then the
 * main action, which is Check, Show answer or Continue.
 */
const TestActions: React.FC<TestActionsProps> = ({
  state,
  onIDontKnow,
  onHint,
  onShowAnswer,
  onCorrectAnswer,
  onNearlyKnew,
  onSubmitAnswer,
  onContinue,
}) => {
  const flashcard = state.answerCategory !== 'character' && answerQuizType(state) === 'flashcard';
  const spokenQuestion = state.questionCategory === 'pinyin' && state.useSound;
  const graded = state.outcome !== null;

  const hintDisabled = state.showAnswer || state.idkDisabled || state.hintLoading;

  const hintButton = (
    <StudyButton disabled={hintDisabled} pressed={state.showHint} onClick={onHint}>
      {state.hintLoading ? (
        <>
          <ButtonSpinner />
          {copy.test.loadingHint}
        </>
      ) : spokenQuestion ? (
        copy.test.hint
      ) : state.showHint ? (
        copy.test.hideHint
      ) : (
        copy.test.showHint
      )}
    </StudyButton>
  );

  const continueButton = state.awaitingContinue && (
    <StudyButton variant="primary" onClick={onContinue} id="continue">
      {copy.test.continue}
    </StudyButton>
  );

  if (flashcard) {
    if (!state.showAnswer) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box sx={{ display: 'flex' }}>{hintButton}</Box>
          <StudyButton variant="primary" onClick={onShowAnswer} id="show-answer">
            {copy.test.showAnswer}
          </StudyButton>
        </Box>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {!graded && (
          <Box sx={{ textAlign: 'center', fontSize: 14, color: colors.textSecondary }}>
            {copy.test.didYouKnow}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <GradeButton
            grade="fail"
            pressed={state.gradeClicked}
            onClick={() => {
              if (state.useSoundEffects) fail.play();
              onIDontKnow();
            }}
          >
            {copy.test.gradeFail}
          </GradeButton>
          <GradeButton grade="lapse" pressed={state.gradeClicked} onClick={onNearlyKnew}>
            {copy.test.gradeLapse}
          </GradeButton>
          {/* Wrapped, because the click event would otherwise arrive as the grade. */}
          <GradeButton grade="pass" pressed={state.gradeClicked} onClick={() => onCorrectAnswer()}>
            {copy.test.gradePass}
          </GradeButton>
        </Box>
        {continueButton}
      </Box>
    );
  }

  // A character that is not known plays its strokes first, with the two
  // buttons switched off, and then waits for Continue.
  if (graded && (state.awaitingContinue || state.answerCategory !== 'character')) {
    return continueButton || null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        {hintButton}
        <StudyButton disabled={state.idkDisabled} onClick={onIDontKnow} id="idk">
          {copy.test.iDontKnow}
        </StudyButton>
      </Box>
      {state.answerCategory !== 'character' && (
        <StudyButton
          variant="primary"
          id="submit-answer"
          disabled={state.submitDisabled || state.answerInput === ''}
          onClick={onSubmitAnswer}
        >
          {copy.test.check}
        </StudyButton>
      )}
    </Box>
  );
};

export default React.memo(TestActions);
