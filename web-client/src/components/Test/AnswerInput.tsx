import React, { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { checkTones } from '../../utils/pinyinMarks';
import { MicButton, hanziSx } from './Study/parts';
import { WRITER_SIZE } from './handwriting';

import { TestState } from './types';
import { answerQuizType } from './answerQuizType';

interface AnswerInputProps {
  state: TestState;
  speechAvailable: boolean;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onInputChanged: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocusEntry: (e: React.FocusEvent<HTMLInputElement>) => void;
  onListen: () => void;
}

const fieldSx = {
  height: 48,
  boxSizing: 'border-box',
  borderRadius: 1,
  bgcolor: colors.card,
  px: 1.75,
  fontFamily: fonts.body,
  fontSize: 17,
  color: colors.text,
  textAlign: 'center',
} as const;

/** The guides of a handwriting box: a cross through the middle. */
const GridGuides: React.FC = () => (
  <>
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        borderLeft: `1px dashed ${colors.gridLine}`,
      }}
    />
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        borderTop: `1px dashed ${colors.gridLine}`,
      }}
    />
  </>
);

const gridBoxSx = (side: number) => ({
  position: 'relative',
  width: side,
  height: side,
  boxSizing: 'border-box',
  bgcolor: colors.card,
  border: `2px solid ${colors.primaryLight}`,
  borderRadius: '2px',
  overflow: 'hidden',
  flex: 'none',
});

/** Where the learner is in a word of several characters. */
const CharacterSteps: React.FC<{ answer: string; index: number; done: boolean }> = ({
  answer,
  index,
  done,
}) => {
  const chars = Array.from(answer);
  return (
    <Box
      role="img"
      aria-label={copy.test.characterProgress(Math.min(index + 1, chars.length), chars.length)}
      sx={{ mt: 1.75, display: 'flex', justifyContent: 'center', gap: 1 }}
    >
      {chars.map((char, i) => {
        const written = done || i < index;
        const current = !written && i === index;
        return (
          <Box
            key={i}
            aria-hidden="true"
            lang={written ? 'zh' : undefined}
            sx={{
              width: 30,
              height: 30,
              boxSizing: 'border-box',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...(written ? {} : { fontSize: 13, fontWeight: 600 }),
              ...(written
                ? {
                    border: `1px solid ${colors.primaryDark}`,
                    bgcolor: colors.successSurface,
                    color: colors.primaryDark,
                    ...hanziSx(20),
                  }
                : current
                  ? { border: `2px solid ${colors.primaryLight}`, color: colors.primaryLight }
                  : { border: `1px solid ${colors.borderStrong}`, color: colors.textSecondary }),
            }}
          >
            {written ? char : i + 1}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * The answer area: the microphone and the answer field, or the handwriting box.
 * A flashcard question has nothing here; its buttons are in TestActions.
 */
const AnswerInput: React.FC<AnswerInputProps> = ({
  state,
  speechAvailable,
  onKeyPress,
  onInputChanged,
  onFocusEntry,
  onListen,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // "Incorrect tones" shows the attempt with the wrong syllables underlined.
  // A tap goes back to the field; the count tells one wrong attempt from the
  // next, since each shows the same words on the status line.
  const [editingAt, setEditingAt] = useState(-1);
  const showTones =
    state.result === copy.test.status.tones &&
    editingAt !== state.toneErrorCount &&
    typeof state.answer === 'string';

  useEffect(() => {
    if (editingAt === state.toneErrorCount) inputRef.current?.focus();
  }, [editingAt, state.toneErrorCount]);

  if (state.answerCategory === 'character') {
    const answer = typeof state.answer === 'string' ? state.answer : '';
    // The reveal of a character the learner did not know: each character,
    // printed in its own box, once the strokes have played.
    if (state.outcome === 'fail' && state.awaitingContinue) {
      return (
        <Box
          sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.5 }}
        >
          {Array.from(answer).map((char, i) => (
            <Box key={i} sx={gridBoxSx(150)}>
              <GridGuides />
              <Box
                lang="zh"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...hanziSx(116, { color: colors.text }),
                }}
              >
                {char}
              </Box>
            </Box>
          ))}
        </Box>
      );
    }
    return (
      <>
        <CharacterSteps
          answer={answer}
          index={state.writingIndex}
          done={state.outcome === 'pass' || state.outcome === 'lapse'}
        />
        {/* The border sits outside the writer's square. */}
        <Box sx={{ ...gridBoxSx(WRITER_SIZE + 4), mx: 'auto', mt: 1.5 }}>
          <GridGuides />
          <Box
            id="character-target-div"
            role="img"
            aria-label={copy.test.drawArea}
            sx={{ position: 'absolute', inset: 0 }}
          />
        </Box>
      </>
    );
  }

  if (answerQuizType(state) === 'flashcard') return null;

  const graded = state.outcome !== null;
  const known = state.outcome === 'pass' || state.outcome === 'lapse';
  const wrong = state.result === copy.test.status.tryAgain;

  // A reveal after "I don't know" has the answer on the card. The attempt the
  // learner made, if any, shows struck through for comparison.
  if (graded && !known) {
    if (state.answerInput === '') return null;
    return (
      <Box
        sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
      >
        <Box sx={{ fontSize: 13, color: colors.textSecondary }}>{copy.test.youTyped}</Box>
        <Box sx={{ fontSize: 18, color: colors.textSecondary, textDecoration: 'line-through' }}>
          {state.answerInput}
        </Box>
      </Box>
    );
  }

  let field: React.ReactNode;
  if (known) {
    // Keep the field's place, so that nothing moves when the answer shows.
    field = (
      <Box
        sx={{
          ...fieldSx,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${colors.primaryDark}`,
          bgcolor: colors.successSurface,
          color: colors.primaryDark,
        }}
      >
        {state.answerInput}
      </Box>
    );
  } else if (showTones) {
    field = (
      <ButtonBase
        onClick={() => setEditingAt(state.toneErrorCount)}
        aria-label={copy.test.answerInput}
        sx={{
          ...fieldSx,
          width: '100%',
          display: 'flex',
          gap: 0.75,
          border: `2px solid ${colors.warningText}`,
        }}
      >
        {checkTones(state.answerInput, state.answer as string).map(({ syllable, wrongTone }, i) => (
          <Box
            component="span"
            key={i}
            sx={
              wrongTone
                ? {
                    textDecoration: 'underline',
                    textDecorationColor: colors.warningText,
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '5px',
                  }
                : undefined
            }
          >
            {syllable}
          </Box>
        ))}
      </ButtonBase>
    );
  } else {
    field = (
      <Box
        component="input"
        ref={inputRef}
        id="answer-input"
        aria-label={copy.test.answerInput}
        placeholder={
          state.answerCategory === 'pinyin'
            ? copy.test.placeholderPinyin
            : copy.test.placeholderMeaning
        }
        value={state.answerInput}
        onChange={onInputChanged}
        onKeyPress={onKeyPress}
        onFocus={onFocusEntry}
        autoFocus={!speechAvailable}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        sx={{
          ...fieldSx,
          width: '100%',
          outline: 'none',
          color: state.listening ? colors.textSecondary : colors.text,
          border: wrong ? `2px solid ${colors.primaryLight}` : `1px solid ${colors.borderStrong}`,
          '&:focus': wrong ? {} : { border: `2px solid ${colors.primaryDark}` },
          '&::placeholder': { color: colors.placeholder },
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {speechAvailable && (
        <MicButton
          listening={state.listening}
          disabled={graded}
          onClick={() => (state.listening ? state.recognition?.abort() : onListen())}
          sx={{ mt: 0.75 }}
        />
      )}
      <Box sx={{ mt: speechAvailable ? 2.5 : 1 }}>{field}</Box>
    </Box>
  );
};

export default React.memo(AnswerInput);
