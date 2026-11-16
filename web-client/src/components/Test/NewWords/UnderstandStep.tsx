import React, { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import WordCard from './WordCard';
import { Overline, PlayButton, hanziSx } from '../Study/parts';
import WordGlossPanel from '../Study/WordGlossPanel';
import { Highlight, SentenceWordButton } from '../../Sentences/shared';
import { getSegmentedSentence } from '../../../services/sentenceService';
import { ResolvedSentence, SentenceWord, resolveSentence } from '../../../utils/sentenceUtils';
import { glossLine, useCharacterGlosses } from '../ComponentReview/useCharacterGlosses';
import { CharacterGloss } from '../ComponentReview/characterGloss';
import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import { Word } from '../../../types/models';

const skeletonSx = { bgcolor: colors.skeleton, borderRadius: '3px' };

interface CharRowProps {
  char: string;
  /** The reading the word gives this character, in tone numbers, if known. */
  syllable: string | undefined;
  gloss: CharacterGloss | undefined;
  open: boolean;
  onToggle: () => void;
}

/**
 * One character of the word. It opens in place to its whole meaning, so the
 * word card stays in view. The parts wait for the Write step (#534).
 */
const CharRow: React.FC<CharRowProps> = ({ char, syllable, gloss, open, onToggle }) => {
  const meaning = glossLine(gloss);
  // The word's own reading, so that 行 in 银行 reads háng, not every reading.
  const pinyin = syllable ? toneMarks(syllable) : gloss?.pinyins.map(toneMarks).join(' / ');

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: colors.card,
        border: `1px solid ${open ? colors.borderStrong : colors.divider}`,
        borderRadius: 1,
      }}
    >
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 2,
          textAlign: 'left',
          fontFamily: fonts.body,
          color: colors.text,
        }}
      >
        <Box lang="zh" sx={hanziSx(40, { width: 48, textAlign: 'center' })}>
          {char}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box lang="zh-Latn" sx={{ fontSize: 16 }}>
            {pinyin}
          </Box>
          <Box
            sx={{
              fontSize: 14,
              color: colors.textSecondary,
              ...(open
                ? {}
                : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
            }}
          >
            {meaning}
          </Box>
        </Box>
        <ExpandMoreRoundedIcon
          sx={{
            color: colors.textSecondary,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </ButtonBase>
    </Box>
  );
};

type ExampleLoad =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'loaded'; sentence: ResolvedSentence };

/**
 * The first example sentence of the word, the same one each time (#459). A word
 * with no sentence, or a failed fetch, shows nothing: the sentence is a help,
 * not a step, so it never asks the learner to retry.
 *
 * Each other word of the sentence opens its meaning from the segment the file
 * already holds, with no fetch. The word under study does not: the word card
 * above gives its meaning. The sheet has no add button, so the introduction
 * changes no list.
 */
const ExampleSentence: React.FC<{
  word: Word;
  charSet: 'simp' | 'trad';
  speak: (text: string) => void;
  loading: boolean;
}> = ({ word, charSet, speak, loading }) => {
  const [load, setLoad] = useState<ExampleLoad>({ status: 'loading' });
  const [openWord, setOpenWord] = useState<SentenceWord | null>(null);

  useEffect(() => {
    let live = true;
    getSegmentedSentence(word.simp, charSet)
      .then(({ sentence }) => {
        if (!live) return;
        setLoad(
          sentence
            ? { status: 'loaded', sentence: resolveSentence(sentence, charSet) }
            : { status: 'none' },
        );
      })
      .catch(() => {
        if (live) setLoad({ status: 'none' });
      });
    return () => {
      live = false;
    };
  }, [word.simp, charSet]);

  if (load.status === 'none') return null;

  // A tap on the open word closes it.
  const showWord = (entry: SentenceWord) => {
    if (openWord === entry) {
      setOpenWord(null);
      return;
    }
    speak(entry[charSet]);
    setOpenWord(entry);
  };

  return (
    <>
      <Overline sx={{ mt: 3, mb: 1 }}>{copy.newWords.example}</Overline>
      {load.status === 'loading' ? (
        // The height of a one-line sentence, so the characters below barely move.
        <Box
          role="status"
          aria-label={copy.newWords.exampleLoading}
          sx={{
            height: 86,
            boxSizing: 'border-box',
            p: 1.75,
            border: `1px solid ${colors.divider}`,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          <Box sx={{ ...skeletonSx, width: '70%', height: 20 }} />
          <Box sx={{ ...skeletonSx, width: '50%', height: 12 }} />
        </Box>
      ) : (
        <Box
          role="group"
          aria-label={copy.newWords.example}
          sx={{
            p: 1.75,
            bgcolor: colors.card,
            border: `1px solid ${colors.divider}`,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box lang="zh" sx={hanziSx(22, { lineHeight: 1.5 })}>
                {load.sentence.chinese.words.length > 0
                  ? load.sentence.chinese.words.map((entry, i) => {
                      if (i === load.sentence.chinese.targetIndex) {
                        return <Highlight key={i}>{entry as string}</Highlight>;
                      }
                      if (typeof entry === 'string') {
                        return <React.Fragment key={i}>{entry}</React.Fragment>;
                      }
                      return (
                        <SentenceWordButton
                          key={i}
                          entry={entry}
                          charSet={charSet}
                          open={openWord === entry}
                          onClick={() => showWord(entry)}
                        />
                      );
                    })
                  : load.sentence.chinese.sentence}
              </Box>
              <Box sx={{ fontSize: 15, color: colors.textSecondary }}>
                {load.sentence.english.sentence}
              </Box>
            </Box>
            <PlayButton
              size={40}
              loading={loading}
              label={copy.newWords.playSentence}
              onClick={() => speak(load.sentence.chinese.sentence)}
            />
          </Box>
          <WordGlossPanel word={openWord} charSet={charSet} added={false} onSpeak={speak} />
        </Box>
      )}
    </>
  );
};

interface UnderstandStepProps {
  word: Word;
  charSet: 'simp' | 'trad';
  speak: (text: string) => void;
  loading: boolean;
}

/** Step 1: the word, then each character with its pinyin and senses. */
const UnderstandStep: React.FC<UnderstandStepProps> = ({ word, charSet, speak, loading }) => {
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const glossOf = useCharacterGlosses(chars, charSet, 'new-words');
  const syllables = useMemo(() => {
    const split = word.pinyin.trim().split(/\s+/);
    return split.length === chars.length ? split : [];
  }, [word.pinyin, chars.length]);
  const [openRow, setOpenRow] = useState<number | null>(null);

  return (
    <>
      <WordCard
        word={word}
        charSet={charSet}
        speak={() => speak(word[charSet])}
        loading={loading}
        highlight={openRow}
      />
      <ExampleSentence word={word} charSet={charSet} speak={speak} loading={loading} />
      <Overline sx={{ mt: 3, mb: 1 }}>{copy.newWords.characters}</Overline>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {chars.map((char, i) => (
          <CharRow
            key={i}
            char={char}
            syllable={syllables[i]}
            gloss={glossOf(char)}
            open={openRow === i}
            onToggle={() => {
              const opening = openRow !== i;
              setOpenRow(opening ? i : null);
              if (opening) speak(char);
            }}
          />
        ))}
      </Box>
    </>
  );
};

export default UnderstandStep;
