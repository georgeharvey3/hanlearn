import React, { FocusEvent, KeyboardEvent, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import Aux from '../../../../hoc/Aux';

import classes from './NewWord.module.css';
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

  const onDisplayMeaning = (char: string): void => {
    fetch(`/api/lookup-chengyu-char/${char}`).then((response) => {
      if (response.ok) {
        response.json().then((data: CharData) => {
          setCharData(data);
        });
      } else {
        setErrorMessage('Error looking up character');
      }
    });
  };

  const onCharacterClick = (char: string): void => {
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
      <Aux>
        <p style={{ fontSize: '3em' }}>{charData.simp}</p>
        <p style={{ fontSize: '1.5em' }}>({charData.pinyins.join('/')})</p>
        <p style={{ fontSize: '1.1em' }}>{charData.meanings.join(' / ')}</p>
      </Aux>
    );
  }

  return (
    <div className={classes.NewWordWrapper}>
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
      </div>
      <div style={{ minHeight: '250px' }}>{charInfo}</div>
    </div>
  );
};

export default connector(NewWord);
