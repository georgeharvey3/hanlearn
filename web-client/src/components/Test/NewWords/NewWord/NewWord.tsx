import React, { Component, KeyboardEvent, FocusEvent } from 'react';
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

interface NewWordState {
  charData: CharData | null;
  charSet: 'simp' | 'trad';
  errorMessage: string;
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
  word: Word;
  isDemo?: boolean;
  isAddedWord?: boolean;
  originalMeaning?: string;
  meaningKeyPressed?: (e: KeyboardEvent<HTMLParagraphElement>) => void;
  meaningBlurred?: (e: FocusEvent<HTMLParagraphElement>) => void;
}

type Props = PropsFromRedux & OwnProps;

class NewWord extends Component<Props, NewWordState> {
  state: NewWordState = {
    charData: null,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    errorMessage: '',
    useSound:
      localStorage.getItem('useSound') === 'false' || !this.props.synthAvailable
        ? false
        : true,
  };

  componentDidMount = (): void => {
    if (this.state.useSound) {
      this.onSpeakPinyin(this.props.word[this.state.charSet]);
    }
  };

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.word.id !== this.props.word.id) {
      if (this.state.useSound) {
        this.onSpeakPinyin(this.props.word[this.state.charSet]);
      }
      this.setState({
        charData: null,
      });
    }
  }

  onSpeakPinyin = (word: string): void => {
    const synth = window.speechSynthesis;
    const utterThis = new SpeechSynthesisUtterance(word);
    utterThis.lang = this.props.lang || 'zh-CN';
    if (this.props.voice) {
      utterThis.voice = this.props.voice;
    }
    utterThis.onerror = (e) => {
      if (e.error === 'synthesis-failed') {
        this.setState({
          errorMessage: 'Error playing pinyin',
        });
      }
    };
    synth.cancel();
    synth.speak(utterThis);
  };

  onDisplayMeaning = (char: string): void => {
    fetch(`/api/lookup-chengyu-char/${char}`).then((response) => {
      if (response.ok) {
        response.json().then((data: CharData) => {
          this.setState({
            charData: data,
          });
        });
      } else {
        this.setState({
          errorMessage: 'Error looking up character',
        });
      }
    });
  };

  onCharacterClick = (char: string): void => {
    this.onDisplayMeaning(char);
    if (
      this.state.useSound ||
      (this.props.isDemo && this.props.synthAvailable)
    ) {
      this.onSpeakPinyin(char);
    }
  };

  render(): React.ReactNode {
    const chars = this.props.word[this.state.charSet].split('');

    let charInfo: React.ReactNode = null;

    if (this.state.charData !== null) {
      charInfo = (
        <Aux>
          <p style={{ fontSize: '3em' }}>{this.state.charData.simp}</p>
          <p style={{ fontSize: '1.5em' }}>
            ({this.state.charData.pinyins.join('/')})
          </p>
          <p style={{ fontSize: '1.1em' }}>
            {this.state.charData.meanings.join(' / ')}
          </p>
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
                  <p
                    className={classes.Char}
                    onClick={() => this.onCharacterClick(char)}
                  >
                    {char}
                  </p>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '0.6em' }}>({this.props.word.pinyin})</p>
          {this.props.isAddedWord ? (
            <p
              style={{ fontSize: '0.7em', marginTop: '5px' }}
              contentEditable
              suppressContentEditableWarning
              data-new-word-meaning
              onKeyPress={this.props.meaningKeyPressed}
              onBlur={this.props.meaningBlurred}
              data-orig={this.props.originalMeaning}
            >
              {this.props.word.meaning}
            </p>
          ) : (
            <p style={{ fontSize: '0.7em', marginTop: '5px' }}>
              {this.props.word.meaning}
            </p>
          )}
        </div>
        <div style={{ minHeight: '250px' }}>{charInfo}</div>
      </div>
    );
  }
}

export default connector(NewWord);
