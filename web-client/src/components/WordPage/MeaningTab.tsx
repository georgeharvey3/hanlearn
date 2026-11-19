import React, { useEffect, useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import { Word } from '../../types/models';
import { toneMarks } from '../../utils/pinyinMarks';
import { ResolvedSentence, SentenceWord, resolveSentence } from '../../utils/sentenceUtils';
import { isCustomWord, sensesOf } from '../../utils/wordPage';
import { getSegmentedSentence } from '../../services/sentenceService';
import { reportError } from '../../services/errorReporting';
import { Highlight, SentenceWordButton } from '../Sentences/shared';
import WordGlossPanel from '../Test/Study/WordGlossPanel';
import { Overline, hanziSx } from '../Test/Study/parts';
import { SpeakButton } from './WordHeader';
import { ReadingsLoad } from './useCharacterReadings';
import { readingLine } from './readingLine';
import * as ttsService from '../../services/ttsService';

type CharSet = 'simp' | 'trad';

/** The first sentence of the word, in file order. Null when it has none. */
const useFirstSentence = (word: Word, charSet: CharSet) => {
  const key = `${word.simp}:${charSet}`;
  const [loaded, setLoaded] = useState<{ key: string; sentence: ResolvedSentence | null }>({
    key: '',
    sentence: null,
  });
  const custom = isCustomWord(word);
  useEffect(() => {
    // The file of a custom word has no entry for it, so it gets no sentence.
    if (custom) return undefined;
    let cancelled = false;
    getSegmentedSentence(word.simp, charSet)
      .then(({ sentence: found }) => {
        if (!cancelled)
          setLoaded({ key, sentence: found ? resolveSentence(found, charSet) : null });
      })
      .catch((error) => reportError(error, { feature: 'word-page-sentence' }));
    return () => {
      cancelled = true;
    };
  }, [key, word.simp, charSet, custom]);
  return loaded.key === key ? loaded.sentence : null;
};

/** The example sentence: the word highlighted, each segment open to its meaning. */
const SentenceCard: React.FC<{
  sentence: ResolvedSentence;
  word: Word;
  charSet: CharSet;
  voice?: SpeechSynthesisVoice;
  lang?: string;
}> = ({ sentence, word, charSet, voice, lang }) => {
  const [open, setOpen] = useState<SentenceWord | null>(null);
  const button = (entry: SentenceWord, key: React.Key) => (
    <SentenceWordButton
      key={key}
      entry={entry}
      charSet={charSet}
      open={open === entry}
      onClick={() => setOpen(open === entry ? null : entry)}
    />
  );

  return (
    <Box
      data-testid="word-sentence"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          component="p"
          lang="zh"
          sx={{ m: 0, flex: 1, fontFamily: fonts.hanzi, fontSize: 26, lineHeight: 1.6 }}
        >
          {sentence.chinese.words.map((segment, i) => {
            if (i === sentence.chinese.targetIndex) {
              return (
                <Highlight key={i}>
                  {sentence.chinese.target
                    ? button(sentence.chinese.target, 'target')
                    : word[charSet]}
                </Highlight>
              );
            }
            if (typeof segment === 'string')
              return <React.Fragment key={i}>{segment}</React.Fragment>;
            return button(segment, i);
          })}
        </Box>
        <SpeakButton
          text={sentence.chinese.sentence}
          label={copy.wordPage.playSentence}
          voice={voice}
          lang={lang}
          size={36}
        />
      </Box>
      <Box lang="zh-Latn" sx={{ fontSize: 14, color: colors.textSecondary }}>
        {sentence.chinese.pinyin}
      </Box>
      <Box sx={{ fontSize: 15, color: colors.textSecondary }}>{sentence.english.sentence}</Box>
      <WordGlossPanel
        word={open}
        charSet={charSet}
        added={false}
        onSpeak={(text) =>
          ttsService.speak(text, { fallbackVoice: voice, fallbackLang: lang || 'zh-CN' })
        }
      />
    </Box>
  );
};

interface Props {
  word: Word;
  owned: Word | null;
  charSet: CharSet;
  chars: string[];
  readingsAt: (index: number) => ReadingsLoad;
  otherReadings: Word[];
  onOpenCharacter: (index: number) => void;
  onOpenReading: (entry: Word) => void;
  voice?: SpeechSynthesisVoice;
  lang?: string;
}

/**
 * The Meaning tab: the meaning that the learner wrote, the senses of the
 * entry, the meaning of each character in this word, the other readings of
 * the characters and one example sentence.
 */
const MeaningTab: React.FC<Props> = ({
  word,
  owned,
  charSet,
  chars,
  readingsAt,
  otherReadings,
  onOpenCharacter,
  onOpenReading,
  voice,
  lang,
}) => {
  const sentence = useFirstSentence(word, charSet);
  const custom = isCustomWord(word);
  // A custom word has one meaning, the learner's, so it is not a numbered list.
  const own = custom ? word.meaning : owned?.ammended_meaning;
  const senses = custom ? [] : sensesOf(word.meaning);

  return (
    <Box sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 2.5, textAlign: 'left' }}>
      {own && (
        <Box data-testid="own-meaning">
          <Overline sx={{ mb: 0.5 }}>{copy.wordPage.yourMeaning}</Overline>
          <Box sx={{ fontSize: 17 }}>{own}</Box>
        </Box>
      )}
      {senses.length > 0 && (
        <Box component="ol" aria-label={copy.wordPage.meaningTab} sx={{ m: 0, pl: 3 }}>
          {senses.map((sense, i) => (
            <Box component="li" key={`${i}-${sense}`} sx={{ fontSize: 16, py: 0.25 }}>
              {sense}
            </Box>
          ))}
        </Box>
      )}
      {chars.length > 1 && (
        <Box>
          <Overline sx={{ mb: 0.75 }}>{copy.wordPage.characters}</Overline>
          <Box
            sx={{ bgcolor: colors.card, border: `1px solid ${colors.divider}`, borderRadius: 1 }}
          >
            {chars.map((char, i) => {
              const line = readingLine(readingsAt(i));
              return (
                <ButtonBase
                  key={`${char}-${i}`}
                  onClick={() => onOpenCharacter(i)}
                  aria-label={copy.wordPage.openCharacter(char)}
                  sx={{
                    width: '100%',
                    minHeight: 56,
                    px: 1.5,
                    py: 1,
                    display: 'grid',
                    gridTemplateColumns: '40px 56px minmax(0, 1fr) 20px',
                    alignItems: 'center',
                    gap: 1,
                    textAlign: 'left',
                    fontFamily: fonts.body,
                    color: colors.text,
                    borderBottom: i < chars.length - 1 ? `1px solid ${colors.divider}` : 'none',
                  }}
                >
                  <Box lang="zh" sx={hanziSx(28)}>
                    {char}
                  </Box>
                  <Box
                    lang="zh-Latn"
                    sx={{ fontSize: 15, fontWeight: 600, color: colors.primaryDark }}
                  >
                    {line.pinyin}
                  </Box>
                  <Box sx={{ fontSize: 14, color: colors.textSecondary, overflowWrap: 'anywhere' }}>
                    {line.senses}
                  </Box>
                  <ChevronRightRoundedIcon aria-hidden sx={{ color: colors.textSecondary }} />
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      )}
      {otherReadings.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Overline sx={{ mr: 0.5 }}>{copy.wordPage.otherReadings}</Overline>
          {otherReadings.map((entry) => (
            <ButtonBase
              key={entry.id}
              onClick={() => onOpenReading(entry)}
              aria-label={copy.wordPage.openReading(entry[charSet], toneMarks(entry.pinyin))}
              sx={{
                height: 36,
                px: 1.5,
                gap: 1,
                borderRadius: 1,
                border: `1px solid ${colors.borderStrong}`,
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.text,
              }}
            >
              <Box component="span" lang="zh" sx={hanziSx(18)}>
                {entry[charSet]}
              </Box>
              <span lang="zh-Latn">{toneMarks(entry.pinyin)}</span>
            </ButtonBase>
          ))}
        </Box>
      )}
      {sentence && (
        <SentenceCard sentence={sentence} word={word} charSet={charSet} voice={voice} lang={lang} />
      )}
    </Box>
  );
};

export default MeaningTab;
