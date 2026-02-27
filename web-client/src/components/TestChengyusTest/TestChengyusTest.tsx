import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { Box, Link, Paper, Typography } from '@mui/material';

import Button from '../UI/Buttons/Button/Button';

import { RootState } from '../../types/store';
import { Word } from '../../types/models';

interface CharData {
  simp: string;
  pinyins: string[];
  meanings: string[];
}

interface TestChengyusTestState {
  wordIndex: number;
  charSet: 'simp' | 'trad';
  charData: CharData | null;
  errorMessage: string;
  showChengyuMeaning: boolean;
  useSound: boolean;
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
  words: Word[];
  isDemo?: boolean;
  startTest?: () => void;
}

type Props = PropsFromRedux & OwnProps;

const TestChengyusTest: React.FC<Props> = ({
  words,
  isDemo,
  startTest,
  synthAvailable,
  voice,
  lang,
}) => {
  const [state, setState] = useState<TestChengyusTestState>(() => ({
    wordIndex: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    charData: null,
    errorMessage: '',
    showChengyuMeaning: false,
    useSound:
      localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true,
  }));

  const onSpeakPinyin = useCallback(
    (word: string): void => {
      const synth = window.speechSynthesis;
      const utterThis = new SpeechSynthesisUtterance(word);
      utterThis.lang = lang || 'zh-CN';
      if (voice) {
        utterThis.voice = voice;
      }
      utterThis.onerror = (e) => {
        if (e.error === 'synthesis-failed') {
          setState((prev) => ({ ...prev, errorMessage: 'Error playing pinyin' }));
        }
      };
      synth.cancel();
      synth.speak(utterThis);
    },
    [lang, voice]
  );

  const onDisplayMeaning = (char: string): void => {
    fetch(`/api/lookup-chengyu-char/${char}`).then((response) => {
      if (response.ok) {
        response.json().then((data: CharData) => {
          setState((prev) => ({ ...prev, charData: data }));
        });
      } else {
        setState((prev) => ({ ...prev, errorMessage: 'Error looking up character' }));
      }
    });
  };

  const onChangeWord = (direction: number): void => {
    setState((prevState) => ({
      ...prevState,
      wordIndex: prevState.wordIndex + direction,
      charData: null,
      showChengyuMeaning: false,
    }));
  };

  const onToggleAnswer = (): void => {
    setState((prevState) => ({
      ...prevState,
      showChengyuMeaning: !prevState.showChengyuMeaning,
    }));
  };

  const onKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === 'ArrowLeft') {
        if (state.wordIndex > 0) {
          onChangeWord(-1);
        }
      }

      if (event.key === 'ArrowRight') {
        if (state.wordIndex < words.length - 1) {
          onChangeWord(1);
        } else {
          startTest?.();
        }
      }

      if (event.key === ' ') {
        onToggleAnswer();
      }
    },
    [onChangeWord, onToggleAnswer, startTest, state.wordIndex, words.length]
  );

  const onCharacterClick = (char: string): void => {
    onDisplayMeaning(char);
    if (state.useSound || (isDemo && synthAvailable)) {
      onSpeakPinyin(char);
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    if (state.useSound) {
      onSpeakPinyin(words[0][state.charSet]);
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown, onSpeakPinyin, state.charSet, state.useSound, words]);

  useEffect(() => {
    if (state.useSound) {
      onSpeakPinyin(words[state.wordIndex][state.charSet]);
    }
  }, [onSpeakPinyin, state.charSet, state.useSound, state.wordIndex, words]);

  const chars = words[state.wordIndex][state.charSet].split('');

  let charInfo: React.ReactNode = null;

  if (state.charData !== null) {
    charInfo = (
      <>
        <Typography sx={{ fontSize: '3em', m: 0 }}>{state.charData.simp}</Typography>
        <Typography sx={{ fontSize: '1.5em', m: 0 }}>({state.charData.pinyins.join('/')})</Typography>
        <Typography sx={{ fontSize: '1.1em', m: 0 }}>{state.charData.meanings.join(' / ')}</Typography>
      </>
    );
  }

  // TODO: Design review — this component uses a custom boxShadow and secondary.main
  // bgcolor that doesn't match the NewWord card style. Consider aligning with the
  // Paper + border pattern used in NewWord/Test components for consistency.
  return (
    <Box sx={{ width: '90%', maxWidth: 400, textAlign: 'center', mx: 'auto', py: '30px', color: 'secondary.main' }}>
      <Typography variant="subtitle1" component="h4">Click on a character to see information</Typography>
      <Paper
        sx={{
          width: '70%',
          bgcolor: 'secondary.main',
          boxShadow: '0 1px 4px black',
          color: 'text.primary',
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
                    bgcolor: 'primary.light',
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
        {state.showChengyuMeaning ? (
          <>
            <p style={{ fontSize: '0.6em' }}>({words[state.wordIndex].pinyin})</p>
            <p style={{ fontSize: '1.1em' }}>{words[state.wordIndex].meaning}</p>
          </>
        ) : null}
      </Paper>
      <Link
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: 'secondary.main' }}
        href={`https://baike.baidu.com/item/${words[state.wordIndex].simp}`}
      >
        Lookup chengyu information
      </Link>
      <Box sx={{ minHeight: 250 }}>{charInfo}</Box>
      <Button style={{ width: '230px', margin: '0 auto' }} clicked={onToggleAnswer}>
        {state.showChengyuMeaning ? 'Hide' : 'Show'} Answer
      </Button>
      <br />
      <Button clicked={() => onChangeWord(-1)} disabled={state.wordIndex < 1}>
        Previous
      </Button>
      <Button
        clicked={() => onChangeWord(1)}
        disabled={state.wordIndex === words.length - 1}
      >
        Next
      </Button>
    </Box>
  );
};

export default connector(TestChengyusTest);
