import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Box, Paper, Typography } from '@mui/material';

import MeaningEditor from '../../../UI/MeaningEditor/MeaningEditor';

import { searchWord } from '../../../../services/dictionaryService';

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
  const [clickedChar, setClickedChar] = useState<string>('');
  const [editedMeaning, setEditedMeaning] = useState(word.meaning);
  const [charSet] = useState<'simp' | 'trad'>(
    (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
  );
  const [, setErrorMessage] = useState('');
  const [useSound] = useState(
    localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true,
  );

  const onSpeakPinyin = useCallback((pinyinWord: string): void => {
    const synth = window.speechSynthesis;
    const utterThis = new SpeechSynthesisUtterance(pinyinWord);
    utterThis.lang = lang || 'zh-CN';
    if (voice) {
      utterThis.voice = voice;
    }
    utterThis.onerror = (e) => {
      if (e.error === 'synthesis-failed') {
        setErrorMessage('Error playing pinyin');
      }
    };
    synth.cancel();
    synth.speak(utterThis);
  }, [lang, voice]);

  const onDisplayMeaning = useCallback(async (char: string): Promise<void> => {
    try {
      const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
      const results = await searchWord(char, charSet);
      if (results.length > 0) {
        const pinyins = Array.from(new Set(results.map((r) => r.pinyin)));
        const meanings = Array.from(new Set(results.map((r) => r.meaning)));
        setCharData({ simp: char, pinyins, meanings });
      } else {
        setErrorMessage('Character not found');
      }
    } catch {
      setErrorMessage('Error looking up character');
    }
  }, []);

  const onCharacterClick = useCallback((char: string): void => {
    setClickedChar(char);
    onDisplayMeaning(char);
    if (useSound || (isDemo && synthAvailable)) {
      onSpeakPinyin(char);
    }
  }, [onDisplayMeaning, useSound, isDemo, synthAvailable, onSpeakPinyin]);

  useEffect(() => {
    if (useSound) {
      onSpeakPinyin(word[charSet]);
    }
    setCharData(null);
    setClickedChar('');
  }, [charSet, useSound, word]);

  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);

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
          {clickedChar || charData.simp}
        </Typography>
        <Typography sx={{ fontSize: '1.2em', color: 'primary.dark', fontWeight: 500, mt: 0.5 }}>
          {charData.pinyins.join(' / ')}
        </Typography>
        <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
          <MeaningEditor value={charData.meanings.join('/')} readOnly size="small" />
        </Box>
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
            const isActive = clickedChar === char;
            return (
              <Box
                key={index}
                onClick={() => onCharacterClick(char)}
                sx={{
                  display: 'inline-block',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor: isActive ? 'primary.main' : 'transparent',
                  transition: 'background-color 0.15s, transform 0.1s',
                  '&:hover': {
                    bgcolor: isActive ? 'primary.main' : 'grey.100',
                  },
                  '&:active': {
                    transform: 'scale(0.95)',
                  },
                }}
              >
                <Typography sx={{ fontSize: 'inherit', lineHeight: 1.3 }}>{char}</Typography>
              </Box>
            );
          })}
        </Box>
        <Typography
          sx={{ fontSize: '0.55em', textAlign: 'center', color: 'text.secondary', mt: 0.5 }}
        >
          {word.pinyin}
        </Typography>
        {isAddedWord ? (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
            <MeaningEditor
              value={editedMeaning}
              onChange={handleMeaningChange}
              size="small"
            />
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
