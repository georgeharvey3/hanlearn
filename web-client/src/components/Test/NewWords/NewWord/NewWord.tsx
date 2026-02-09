import React, { FocusEvent, KeyboardEvent, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Box, Paper, Typography } from '@mui/material';

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
  originalMeaning?: string;
  meaningKeyPressed?: (e: KeyboardEvent<HTMLParagraphElement>) => void;
  meaningBlurred?: (e: FocusEvent<HTMLParagraphElement>) => void;
}

type Props = PropsFromRedux & OwnProps;

const NewWord: React.FC<Props> = ({
  synthAvailable,
  voice,
  lang,
  word,
  isDemo,
  isAddedWord,
  originalMeaning,
  meaningKeyPressed,
  meaningBlurred,
}) => {
  const [charData, setCharData] = useState<CharData | null>(null);
  const [clickedChar, setClickedChar] = useState<string>('');
  const [charSet] = useState<'simp' | 'trad'>(
    (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp'
  );
  const [, setErrorMessage] = useState('');
  const [useSound] = useState(
    localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true
  );

  const onSpeakPinyin = (pinyinWord: string): void => {
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
  };

  const onDisplayMeaning = async (char: string): Promise<void> => {
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
  };

  const onCharacterClick = (char: string): void => {
    setClickedChar(char);
    onDisplayMeaning(char);
    if (useSound || (isDemo && synthAvailable)) {
      onSpeakPinyin(char);
    }
  };

  useEffect(() => {
    if (useSound) {
      onSpeakPinyin(word[charSet]);
    }
    setCharData(null);
  }, [charSet, useSound, word]);

  const chars = word[charSet].split('');

  let charInfo: React.ReactNode = null;

  if (charData !== null) {
    charInfo = (
      <>
        <Typography sx={{ fontSize: '3em', m: 0 }}>{clickedChar || charData.simp}</Typography>
        <Typography sx={{ fontSize: '1.5em', m: 0 }}>({charData.pinyins.join('/')})</Typography>
        <Typography sx={{ fontSize: '1.1em', m: 0 }}>{charData.meanings.join(' / ')}</Typography>
      </>
    );
  }

  return (
    <Box>
      <Paper
        sx={{
          width: '70%',
          bgcolor: 'secondary.main',
          boxShadow: '0 1px 4px black',
          color: 'rgb(46, 66, 66)',
          borderRadius: 1,
          minHeight: 110,
          mx: 'auto',
          mb: '10px',
          p: '10px 5px',
          fontSize: '1.6em',
          '& p': { m: 0 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {chars.map((char, index) => {
            return (
              <Box
                key={index}
                sx={{
                  display: 'inline-block',
                  p: '2px',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'rgb(197, 197, 106)',
                    cursor: 'pointer',
                  },
                }}
              >
                <p onClick={() => onCharacterClick(char)}>
                  {char}
                </p>
              </Box>
            );
          })}
        </Box>
        <p style={{ fontSize: '0.6em' }}>({word.pinyin})</p>
        {isAddedWord ? (
          <p
            style={{ fontSize: '0.7em', marginTop: '5px' }}
            contentEditable
            suppressContentEditableWarning
            data-new-word-meaning
            onKeyPress={meaningKeyPressed}
            onBlur={meaningBlurred}
            data-orig={originalMeaning}
          >
            {word.meaning}
          </p>
        ) : (
          <p style={{ fontSize: '0.7em', marginTop: '5px' }}>{word.meaning}</p>
        )}
      </Paper>
      <Box sx={{ minHeight: 250 }}>{charInfo}</Box>
    </Box>
  );
};

export default connector(NewWord);
