import React, { useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { toneMarks } from '../../utils/pinyinMarks';
import {
  CardRule,
  CardSize,
  PillToggle,
  PlayButton,
  StudyCard,
  hanziSize,
  hanziSx,
} from './Study/parts';
import { answerQuizType } from './answerQuizType';
import { TestState } from './types';

interface QuestionDisplayProps {
  state: TestState;
  onSpeak: (word: string) => void;
  onToggleShowPinyin: () => void;
  showCharacter: () => void;
}

/** The senses a meaning question shows before "+ N more senses". */
const SENSES_SHOWN = 6;

// A meaning can be a long dictionary entry. At the size of a short one it fills
// the card and pushes the answer area off the screen, so the text gets smaller
// as it gets longer.
function meaningSize(text: string, size: CardSize): number {
  const base = text.length <= 30 ? 30 : text.length <= 80 ? 20 : 17;
  return size === 'large' ? base : Math.min(base, size === 'medium' ? 22 : 18);
}

function asList(value: string | string[] | null): string[] {
  if (value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** The hint, drawn inside the card under the question. */
const Hint: React.FC<{ state: TestState }> = ({ state }) => {
  if (!state.showHint) return null;
  const dashed = {
    border: `1px dashed ${colors.borderStrong}`,
    borderRadius: 1,
    color: colors.textSecondary,
  };

  if (state.answerCategory === 'pinyin' && state.hint) {
    const initials = state.hint.split(' ');
    return (
      <Box
        role="img"
        aria-label={copy.test.hintLabel(initials.map((i) => i.replace(/_/g, '')).join(', '))}
        sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1.25 }}
      >
        {initials.map((initial, i) => (
          <Box key={i} aria-hidden="true" sx={{ ...dashed, px: 1.25, py: 0.5, fontSize: 20 }}>
            {initial}
          </Box>
        ))}
      </Box>
    );
  }

  if (state.answerCategory === 'meaning') {
    if (state.hint) {
      return (
        <Box
          lang="zh-Latn"
          sx={{ ...dashed, maxWidth: 300, px: 1.75, py: 1, fontSize: 17, lineHeight: 1.4 }}
        >
          {state.hint}
        </Box>
      );
    }
    // Sound is on, so the sentence plays aloud and has no text to show.
    return (
      <Box
        sx={{
          ...dashed,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.75,
          py: 1,
          fontSize: 14,
        }}
      >
        <GraphicEqRoundedIcon sx={{ fontSize: 18, color: colors.primaryDark }} />
        {copy.test.exampleSentence}
      </Box>
    );
  }

  return null;
};

/** The pinyin of a word, with tone marks. */
const Pinyin: React.FC<{ text: string; size: number; color?: string; bold?: boolean }> = ({
  text,
  size,
  color = colors.text,
  bold,
}) => (
  <Box lang="zh-Latn" sx={{ fontSize: size, color, fontWeight: bold ? 600 : 400 }}>
    {toneMarks(text)}
  </Box>
);

/**
 * The question card, from the question to its full reveal.
 *
 * A question shows only what is asked. A graded question adds the rest of the
 * word, and the part the learner was asked for is red when it was not known.
 */
const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  state,
  onSpeak,
  onToggleShowPinyin,
  showCharacter,
}) => {
  const [allSenses, setAllSenses] = useState<string | null>(null);

  const word = state.currentPair ? state.testSet[parseInt(state.currentPair.index)] : undefined;
  const hanzi = state.chosenCharacter ?? '';
  const flashcard = answerQuizType(state) === 'flashcard';
  const revealed = state.outcome !== null || state.showAnswer;
  const failed = state.outcome === 'fail';
  const compact = state.componentReviewChars.length > 0;
  const size: CardSize = compact ? 'small' : revealed && failed ? 'medium' : 'large';
  const height = compact ? 170 : flashcard ? 340 : state.answerCategory === 'character' ? 132 : 280;
  const lapse = state.gradeCap === 'lapse' || state.outcome === 'lapse';
  const asked = (category: string) => state.answerCategory === category;
  // The asked part of a reveal: red when it was not known, bold on a flashcard.
  const answerColor = failed ? colors.primaryLight : colors.text;

  const pinyin = word?.pinyin ?? '';
  const meanings = asList(state.questionCategory === 'meaning' ? state.question : state.answer);
  const meaningText = meanings.join(' · ');
  const speak = () => state.chosenCharacter && onSpeak(state.chosenCharacter);
  const playCorner = revealed && state.useSound && (
    <IconButton
      aria-label={copy.test.playPronunciation}
      onClick={speak}
      sx={{
        position: 'absolute',
        left: 8,
        top: 8,
        width: 44,
        height: 44,
        color: colors.textSecondary,
      }}
    >
      <VolumeUpRoundedIcon sx={{ fontSize: 22 }} />
    </IconButton>
  );

  const meaningLine = (fontSize: number, color: string, bold: boolean) => (
    <Box sx={{ fontSize, color, fontWeight: bold ? 600 : 400, lineHeight: 1.3 }}>{meaningText}</Box>
  );

  let content: React.ReactNode;

  if (state.questionCategory === 'character') {
    // MC and PC: the character is asked about.
    content = (
      <>
        <Box lang="zh" sx={hanziSx(hanziSize(hanzi, size))}>
          {hanzi}
        </Box>
        {revealed && flashcard && !compact && <CardRule />}
        {revealed && (
          <Pinyin
            text={pinyin}
            size={compact ? 18 : 22}
            color={asked('pinyin') ? answerColor : colors.text}
          />
        )}
        {revealed &&
          meaningLine(
            compact ? 15 : flashcard && asked('meaning') ? 20 : 16,
            asked('meaning')
              ? failed
                ? colors.primaryLight
                : flashcard
                  ? colors.text
                  : colors.textSecondary
              : colors.textSecondary,
            asked('meaning') && (failed || flashcard),
          )}
        <Hint state={state} />
      </>
    );
  } else if (state.questionCategory === 'meaning') {
    // PM and CM: the meaning is asked about.
    const shown =
      allSenses === meaningText || revealed ? meanings : meanings.slice(0, SENSES_SHOWN);
    const hidden = meanings.length - shown.length;
    const writing = asked('character');
    content = (
      <>
        <Box
          sx={{
            fontSize: writing
              ? compact
                ? 22
                : revealed
                  ? 24
                  : 26
              : meaningSize(shown.join(' · '), revealed && failed && !flashcard ? 'small' : size),
            fontWeight: 500,
            lineHeight: 1.3,
            color:
              revealed && failed && !writing && !flashcard ? colors.textSecondary : colors.text,
          }}
        >
          {shown.join(' · ')}
        </Box>
        {hidden > 0 && (
          <ButtonBase
            onClick={() => setAllSenses(meaningText)}
            sx={{
              height: 36,
              px: 1.5,
              fontFamily: fonts.body,
              fontSize: 14,
              fontWeight: 600,
              color: colors.primaryDark,
            }}
          >
            {copy.test.moreSenses(hidden)}
          </ButtonBase>
        )}
        {writing && compact && (
          <Box lang="zh" sx={hanziSx(48)}>
            {hanzi}
          </Box>
        )}
        {writing && revealed && (
          <Pinyin text={pinyin} size={compact ? 16 : 18} color={colors.textSecondary} />
        )}
        {!writing && revealed && (
          <>
            {(flashcard || failed) && <CardRule />}
            <Pinyin
              text={pinyin}
              size={failed && !flashcard ? 30 : flashcard ? 24 : 22}
              color={answerColor}
              bold={failed && !flashcard}
            />
            <Box lang="zh" sx={hanziSx(flashcard || failed ? 48 : 40)}>
              {hanzi}
            </Box>
          </>
        )}
        <Hint state={state} />
      </>
    );
  } else if (state.questionCategory === 'pinyin') {
    // MP: the learner hears the word, or reads its pinyin when sound is off.
    const audio = state.useSound && !state.showPinyin;
    if (revealed) {
      content = (
        <>
          {audio && <PlayButton size={56} loading={false} onClick={speak} />}
          {audio && <CardRule />}
          <Box lang="zh" sx={hanziSx(compact ? 40 : 56)}>
            {hanzi}
          </Box>
          <Pinyin text={pinyin} size={20} />
          {meaningLine(
            flashcard || failed ? 20 : 16,
            failed ? colors.primaryLight : flashcard ? colors.text : colors.textSecondary,
            flashcard || failed,
          )}
        </>
      );
    } else if (audio) {
      const singleChar = hanzi.length === 1;
      const shownChar = state.showQuestionCharacter && singleChar;
      const shownPinyin = state.showQuestionPinyin;
      content = (
        <>
          {shownChar ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PlayButton size={56} loading={state.synthLoading} onClick={speak} />
              <Box component="span" lang="zh" sx={hanziSx(64)}>
                {hanzi}
              </Box>
            </Box>
          ) : (
            <PlayButton size={96} loading={state.synthLoading} onClick={speak} />
          )}
          {shownPinyin && <Pinyin text={pinyin} size={24} />}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            <PillToggle pressed={shownPinyin} onClick={onToggleShowPinyin}>
              {shownPinyin ? copy.test.hidePinyin : copy.test.showPinyin}
            </PillToggle>
            {singleChar && (
              <PillToggle pressed={shownChar} onClick={showCharacter}>
                {shownChar ? copy.test.hideCharacter : copy.test.showCharacter}
              </PillToggle>
            )}
          </Box>
          <Hint state={state} />
        </>
      );
    } else {
      content = (
        <>
          <Box lang="zh-Latn" sx={{ fontSize: 44, letterSpacing: '0.02em' }}>
            {toneMarks(pinyin)}
          </Box>
          <Hint state={state} />
        </>
      );
    }
  }

  // A reveal of the spoken question has its play button in the middle.
  const corner = state.questionCategory === 'pinyin' ? null : playCorner;

  return (
    <StudyCard
      height={height}
      lapse={lapse}
      corner={corner}
      sx={{ gap: compact ? 0.75 : revealed ? 1.5 : 2.25 }}
    >
      {content}
    </StudyCard>
  );
};

export default React.memo(QuestionDisplay);
