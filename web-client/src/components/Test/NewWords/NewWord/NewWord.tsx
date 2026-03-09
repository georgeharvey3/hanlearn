import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Box, ButtonBase, CircularProgress, Paper, Typography } from '@mui/material';

import MeaningEditor from '../../../UI/MeaningEditor/MeaningEditor';
import PictureButton from '../../../UI/Buttons/PictureButton/PictureButton';

import speakerPic from '../../../../assets/images/speaker.png';

import { searchWord } from '../../../../services/dictionaryService';
import * as ttsService from '../../../../services/ttsService';

import { RootState } from '../../../../types/store';
import { Word } from '../../../../types/models';

interface CharData {
  simp: string;
  pinyins: string[];
  meanings: string[];
}

const mapStateToProps = (state: RootState) => {
  return {
    synthAvailable: state.settings.synthAvailable,
    voice: state.settings.voice,
    lang: state.settings.lang,
  };
};

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  word: Word;
  isDemo?: boolean;
  isAddedWord?: boolean;
  compact?: boolean;
  onMeaningChange?: (meaning: string) => void;
}

type Props = PropsFromRedux & OwnProps;

const NewWord: React.FC<Props> = ({
  synthAvailable,
  voice,
  lang,
  word,
  isDemo,
  isAddedWord,
  compact,
  onMeaningChange,
}) => {
  const [charData, setCharData] = useState<CharData | null>(null);
  const [charLoading, setCharLoading] = useState(false);
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const charCache = useRef<Map<string, CharData>>(new Map());
  const [editedMeaning, setEditedMeaning] = useState(word.meaning);
  const [charSet] = useState<'simp' | 'trad'>(
    (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
  );
  const [useSound] = useState(
    localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true,
  );
  const [synthLoading, setSynthLoading] = useState(false);

  const onSpeakPinyin = useCallback(
    (pinyinWord: string): void => {
      setSynthLoading(true);
      ttsService.speak(pinyinWord, {
        fallbackVoice: voice,
        fallbackLang: lang || 'zh-CN',
        onStart: () => {
          setSynthLoading(false);
        },
        onEnd: () => {
          setSynthLoading(false);
        },
        onError: () => {
          setSynthLoading(false);
        },
      });
    },
    [lang, voice],
  );

  const onDisplayMeaning = useCallback(async (char: string): Promise<void> => {
    try {
      const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
      const results = await searchWord(char, charSet);
      let data: CharData;
      if (results.length > 0) {
        const pinyins = Array.from(new Set(results.map((r) => r.pinyin)));
        const meanings = Array.from(new Set(results.map((r) => r.meaning)));
        data = { simp: char, pinyins, meanings };
      } else {
        data = { simp: char, pinyins: [], meanings: ['(not found in dictionary)'] };
      }
      charCache.current.set(char, data);
      setCharData(data);
    } catch {
      setCharData({ simp: char, pinyins: [], meanings: ['(lookup failed)'] });
    } finally {
      setCharLoading(false);
    }
  }, []);

  const onCharacterClick = useCallback(
    (char: string, index: number): void => {
      setClickedIndex(index);
      const cached = charCache.current.get(char);
      if (cached) {
        setCharData(cached);
        setCharLoading(false);
      } else {
        setCharLoading(true);
        setCharData({ simp: char, pinyins: [], meanings: [] });
        onDisplayMeaning(char);
      }
      try {
        if (useSound || (isDemo && synthAvailable)) {
          onSpeakPinyin(char);
        }
      } catch {
        // Speech synthesis can fail on mobile — don't let it break the click
      }
    },
    [onDisplayMeaning, useSound, isDemo, synthAvailable, onSpeakPinyin],
  );

  const wordId = `${word.simp}-${word.trad}`;
  useEffect(() => {
    try {
      if (useSound) {
        onSpeakPinyin(word[charSet]);
      }
    } catch {
      // Speech synthesis can fail on mobile
    }
    setCharData(null);
    setClickedIndex(null);
    setCharLoading(false);
    charCache.current.clear();
  }, [charSet, useSound, wordId]);

  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);

  // Pre-fetch character data for all characters in the word
  useEffect(() => {
    const uniqueChars = Array.from(new Set(chars));
    uniqueChars.forEach(async (char) => {
      if (charCache.current.has(char)) return;
      try {
        const results = await searchWord(char, charSet);
        if (results.length > 0) {
          const pinyins = Array.from(new Set(results.map((r) => r.pinyin)));
          const meanings = Array.from(new Set(results.map((r) => r.meaning)));
          charCache.current.set(char, { simp: char, pinyins, meanings });
        } else {
          charCache.current.set(char, {
            simp: char,
            pinyins: [],
            meanings: ['(not found in dictionary)'],
          });
        }
      } catch {
        // Pre-fetch failures are non-critical; will fall back to on-click fetch
      }
    });
  }, [wordId, chars, charSet]);

  const handleMeaningChange = useCallback(
    (newValue: string) => {
      setEditedMeaning(newValue);
      onMeaningChange?.(newValue);
    },
    [onMeaningChange],
  );

  const charInfo: React.ReactNode =
    charData === null ? (
      <Typography
        sx={{
          color: 'text.disabled',
          fontSize: '0.85em',
          textAlign: 'center',
          py: 3,
          fontStyle: 'italic',
        }}
      >
        Tap a character above to see its details
      </Typography>
    ) : (
      <Box sx={{ textAlign: 'center', py: 1.5 }}>
        <Typography
          sx={{ fontSize: '2.8em', fontWeight: 500, lineHeight: 1.2, color: 'text.primary' }}
        >
          {clickedIndex !== null ? chars[clickedIndex] : charData.simp}
        </Typography>
        {charLoading ? (
          <CircularProgress size={24} sx={{ mt: 1.5 }} />
        ) : (
          <>
            <Typography sx={{ fontSize: '1.2em', color: 'primary.dark', fontWeight: 500, mt: 0.5 }}>
              {charData.pinyins.join(' / ')}
            </Typography>
            <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
              <MeaningEditor value={charData.meanings.join('/')} readOnly size="small" />
            </Box>
          </>
        )}
      </Box>
    );

  return (
    <Box>
      <Paper
        elevation={compact ? 0 : 2}
        sx={{
          width: compact ? '100%' : '85%',
          bgcolor: compact ? 'grey.50' : 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          borderRadius: 3,
          minHeight: compact ? 'auto' : 110,
          mx: 'auto',
          mb: compact ? 0 : 1,
          p: compact ? 2.5 : '20px 16px 16px',
          fontSize: '1.6em',
          '& p': { m: 0 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
          {chars.map((char, index) => {
            const isActive = clickedIndex === index;
            return (
              <ButtonBase
                key={index}
                onClick={() => onCharacterClick(char, index)}
                aria-label={`Show details for ${char}`}
                aria-pressed={isActive}
                sx={{
                  fontSize: 'inherit',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1.5,
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  transition: 'background-color 0.15s, transform 0.1s',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.main' : 'grey.100',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  },
                }}
              >
                <Typography sx={{ fontSize: 'inherit', lineHeight: 1.3 }}>{char}</Typography>
              </ButtonBase>
            );
          })}
        </Box>
        <Typography
          sx={{ fontSize: '0.55em', textAlign: 'center', color: 'text.secondary', mt: 0.5 }}
        >
          {word.pinyin}
        </Typography>
        {useSound && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mt: 1,
              height: 40,
            }}
          >
            {synthLoading ? (
              <CircularProgress size={24} color="primary" />
            ) : (
              <PictureButton
                type="secondary"
                src={speakerPic}
                aria-label="Play pronunciation"
                clicked={() => onSpeakPinyin(word[charSet])}
              />
            )}
          </Box>
        )}
        {isAddedWord ? (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
            <MeaningEditor value={editedMeaning} onChange={handleMeaningChange} size="small" />
          </Box>
        ) : (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
            <MeaningEditor value={word.meaning} readOnly size="small" />
          </Box>
        )}
      </Paper>
      <Box sx={{ minHeight: compact ? 160 : 200, mt: compact ? 1.5 : 1 }}>{charInfo}</Box>
    </Box>
  );
};

export default connector(NewWord);
