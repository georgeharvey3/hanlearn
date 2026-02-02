import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import Aux from '../../hoc/Aux';
import Button from '../UI/Buttons/Button/Button';

import classes from './TestChengyusTest.module.css';
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
      <Aux>
        <p style={{ fontSize: '3em' }}>{state.charData.simp}</p>
        <p style={{ fontSize: '1.5em' }}>({state.charData.pinyins.join('/')})</p>
        <p style={{ fontSize: '1.1em' }}>{state.charData.meanings.join(' / ')}</p>
      </Aux>
    );
  }

  return (
    <div className={classes.TestChengyusTest}>
      <h4>Click on a character to see information</h4>
      <div className={classes.CharCard}>
        <div className={classes.CharHolder}>
          {chars.map((char, index) => {
            return (
              <div key={index}>
                <p className={classes.Char} onClick={() => onCharacterClick(char)}>
                  {char}
                </p>
              </div>
            );
          })}
        </div>
        {state.showChengyuMeaning ? (
          <Aux>
            <p style={{ fontSize: '0.6em' }}>({words[state.wordIndex].pinyin})</p>
            <p style={{ fontSize: '1.1em' }}>{words[state.wordIndex].meaning}</p>
          </Aux>
        ) : null}
      </div>
      <a
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#E6E0AE' }}
        href={`https://baike.baidu.com/item/${words[state.wordIndex].simp}`}
      >
        Lookup chengyu information
      </a>
      <div style={{ minHeight: '250px' }}>{charInfo}</div>
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
    </div>
  );
};

export default connector(TestChengyusTest);
