import React, { ChangeEvent, FocusEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';

import Aux from '../../hoc/Aux';
import Modal from '../../components/UI/Modal/Modal';
import MainBanner from '../../components/AddWords/MainBanner';
import Table from '../../components/UI/Table/Table';
import Button from '../../components/UI/Buttons/Button/Button';
import * as wordActions from '../../store/actions/index';
import Remove from '../../components/UI/Table/TableRow/Remove/Remove';
import Spinner from '../../components/UI/Spinner/Spinner';
import Input from '../../components/UI/Input/Input';

import classes from './AddWords.module.css';
import NewWord from '../../components/Test/NewWords/NewWord/NewWord';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import * as wordService from '../../services/wordService';

interface AddWordsState {
  newWord: string;
  errorMessage: string;
  showErrorMessage: boolean;
  clashChar: string;
  clashWords: Word[];
  showClashTable: boolean;
  charSet: 'simp' | 'trad';
  loading: boolean;
  addError: boolean;
  showWords: boolean;
  justAdded: Word | null;
  meaning: string;
  meaningInputDisabled: boolean;
  showMeaningInput: boolean;
  showNewWordModal: boolean;
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  error: state.addWords.error,
  loading: state.addWords.loading,
  userId: state.auth.userId,
  authInitialized: state.auth.initialized,
});

const mapDispatchToProps = {
  onPostWord: wordActions.postWord,
  onPostCustomWord: wordActions.postCustomWord,
  onDeleteWord: wordActions.deleteWord,
  onInitWords: wordActions.initWords,
  onPostMeaningUpdate: wordActions.postUpdateMeaning,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const AddWords: React.FC<Props> = ({
  words,
  error,
  loading,
  userId,
  authInitialized,
  onInitWords,
  onPostWord,
  onPostCustomWord,
  onDeleteWord,
  onPostMeaningUpdate,
  history,
  isDemo,
}) => {
  const [state, setState] = useState<AddWordsState>(() => {
    const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';
    return {
      newWord: '',
      errorMessage: '',
      showErrorMessage: false,
      clashChar: '',
      clashWords: [],
      showClashTable: false,
      charSet: charSet,
      loading: false,
      addError: false,
      showWords: true,
      justAdded: null,
      meaning: '',
      meaningInputDisabled: false,
      showMeaningInput: false,
      showNewWordModal: false,
    };
  });

  const prevJustAddedId = useRef<number | null | undefined>(undefined);

  const updateState = useCallback((partial: Partial<AddWordsState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const dismissModal = useCallback((): void => {
    updateState({ showErrorMessage: false, newWord: '' });
  }, [updateState]);

  const dismissClashTable = useCallback((): void => {
    updateState({ showClashTable: false, newWord: '' });
  }, [updateState]);

  const dismissMeaningInput = useCallback((): void => {
    updateState({ showMeaningInput: false, newWord: '' });
    const mainInput = document.querySelector('#addInput') as HTMLInputElement | null;

    if (mainInput) {
      mainInput.focus();
    }
  }, [updateState]);

  const dismissNewWordModal = useCallback((): void => {
    updateState({ showNewWordModal: false });
    const input = document.querySelector('#addInput') as HTMLInputElement | null;
    if (input) {
      input.focus();
    }
  }, [updateState]);

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (state.showErrorMessage) {
          dismissModal();
        }

        if (state.showClashTable) {
          dismissClashTable();
        }

        if (state.showMeaningInput) {
          dismissMeaningInput();
        }

        if (state.showNewWordModal) {
          dismissNewWordModal();
        }
      }
    },
    [dismissClashTable, dismissMeaningInput, dismissModal, dismissNewWordModal, state.showClashTable, state.showErrorMessage, state.showMeaningInput, state.showNewWordModal]
  );

  // Initialize words when userId becomes available
  useEffect(() => {
    if (userId !== null) {
      onInitWords();
    }
  }, [onInitWords, userId]);

  // Separate effect for keyup listener to avoid re-fetching words when modal state changes
  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyUp]);

  useEffect(() => {
    if (prevJustAddedId.current !== state.justAdded?.id) {
      if (state.justAdded) {
        updateState({ showNewWordModal: true });
      }
    }
    prevJustAddedId.current = state.justAdded?.id;
  }, [state.justAdded, updateState]);

  const onInputChangedHandler = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ newWord: event.target.value });
  };

  const handleSearchResult = (res: Word[], searchedWord: string): void => {
    if (res.length === 0) {
      (document.getElementById('addInput') as HTMLInputElement | null)?.blur();
      updateState({
        errorMessage: `The word ${searchedWord} could not be found`,
        showMeaningInput: true,
      });

      const input = document.querySelector('#meaning') as HTMLInputElement | null;
      if (!input) {
        return;
      }
      setTimeout(() => {
        input.focus();
      }, 1);
      return;
    }
    if (res.length === 1) {
      const word = res[0];
      for (let i = 0; i < words.length; i++) {
        if (words[i].id === word.id) {
          updateState({
            errorMessage: `The word ${searchedWord} is already in your bank`,
            showErrorMessage: true,
          });
          return;
        }
      }
      onPostWord(word);
      updateState({ newWord: '', justAdded: word });
    }

    if (res.length > 1) {
      updateState({
        clashChar: res[0][state.charSet],
        clashWords: res,
        showClashTable: true,
      });
    }
  };

  const searchForWord = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (state.newWord === '') {
      return;
    }

    updateState({ loading: true });
    try {
      const words = await wordService.searchWord(state.newWord, state.charSet);
      updateState({
        loading: false,
        addError: false,
      });
      handleSearchResult(words, state.newWord);
    } catch (error) {
      console.error('Failed to search for word:', error);
      updateState({
        loading: false,
        addError: true,
        newWord: '',
      });
    }
  };

  const onMeaningKeyPress = (e: KeyboardEvent<HTMLTableCellElement>, wordID: number): void => {
    if (e.key !== 'Enter') {
      return;
    }

    e.preventDefault();

    const newMeaning = (e.target as HTMLElement).textContent || '';

    // eslint-disable-next-line no-useless-escape
    const regex = "^[A-Za-z'()-? ]+(?:/[[A-Za-z'()-? ]+)*$";
    if (!newMeaning.match(regex)) {
      return;
    }

    (e.target as HTMLElement).dataset.orig = newMeaning;
    onPostMeaningUpdate(wordID, newMeaning);
    (e.target as HTMLElement).blur();
  };

  const onBlurMeaning = (e: FocusEvent<HTMLTableCellElement>): void => {
    (e.target as HTMLElement).textContent = (e.target as HTMLElement).dataset.orig || '';
  };

  const onTestHandler = (): void => {
    // Navigate to test page - practice mode is available there if no words are due
    history.push('/test-words');
  };

  const convertDateString = (initial: string): string => {
    const year = initial.slice(0, 4);
    const month = initial.slice(5, 7);
    const day = initial.slice(8);

    return [day, month, year].join('/');
  };

  const toggleWords = (): void => {
    setState((prevState) => ({ ...prevState, showWords: !prevState.showWords }));
  };

  const meaningChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ meaning: event.target.value });
  };

  const meaningKeyPressed = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      meaningSubmitClicked();
    }
  };

  const meaningSubmitClicked = (): void => {
    const customWord = {
      simp: state.newWord,
      meaning: state.meaning,
    } as Word;

    onPostCustomWord(customWord);
    updateState({
      showMeaningInput: false,
      meaning: '',
      newWord: '',
      justAdded: customWord,
    });
    const mainInput = document.querySelector('#addInput') as HTMLInputElement | null;

    if (mainInput) {
      mainInput.focus();
    }
  };

  const onUpdateMeaningClicked = (): void => {
    const meaningElement = document.querySelector('[data-new-word-meaning]') as HTMLElement | null;

    if (!meaningElement) {
      return;
    }

    meaningElement.focus();
  };

  // Wait for auth to initialize before redirecting
  if (!authInitialized) {
    return null;
  }
  if (userId === null) {
    return <Redirect to="/" />;
  }

  let table: React.ReactNode = loading ? <Spinner /> : null;

  const tableWords = words;

  if (tableWords) {
    const tableRows = tableWords.map((row, index) => {
      return (
        <tr key={index}>
          <td>{row[state.charSet]}</td>
          <td>{row.pinyin}</td>
          <td
            contentEditable={true}
            suppressContentEditableWarning={true}
            onKeyPress={(e: KeyboardEvent<HTMLTableCellElement>) =>
              onMeaningKeyPress(e, row.id)
            }
            onBlur={onBlurMeaning}
            data-orig={row.meaning}
          >
            {row.meaning}
          </td>
          <td className="Disappear">{convertDateString(row.due_date || '')}</td>
          <td>
            <Remove clicked={() => onDeleteWord(row.id)} />
          </td>
        </tr>
      );
    });

    table = (
      <Table headings={['Character(s)', 'Pinyin', 'Meaning', 'Due Date (D/M/Y)', 'Remove']}>
        {tableRows}
      </Table>
    );
  }

  if (!state.showWords) {
    table = null;
  }

  if (error) {
    table = <p style={{ fontSize: '20px', color: '#E6E0AE' }}>Error: Could not fetch words</p>;
  }

  if (state.addError) {
    table = (
      <p style={{ fontSize: '20px', color: '#E6E0AE' }}>Error: Could not search for word</p>
    );
  }

  let clashTableRows: React.ReactNode = null;

  if (state.clashWords.length > 0) {
    clashTableRows = state.clashWords.map((word, index) => {
      return (
        <tr
          key={index}
          className="Hoverable"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            handleSearchResult([word], word[state.charSet]);
            updateState({
              clashChar: '',
              clashWords: [],
              showClashTable: false,
            });
          }}
        >
          <td>{word.pinyin}</td>
          <td>{word.meaning}</td>
        </tr>
      );
    });
  }

  const buttonText = state.showWords ? 'Hide Table' : 'Show Table';

  return (
    <Aux>
      {state.justAdded !== null ? (
        <Modal show={state.showNewWordModal} modalClosed={dismissNewWordModal}>
          <h2>Just added</h2>
          <NewWord
            word={state.justAdded}
            isDemo={isDemo}
            isAddedWord={true}
            meaningKeyPressed={(e: KeyboardEvent<HTMLParagraphElement>) =>
              onMeaningKeyPress(
                e as unknown as KeyboardEvent<HTMLTableCellElement>,
                state.justAdded!.id
              )
            }
            meaningBlurred={
              onBlurMeaning as unknown as (e: FocusEvent<HTMLParagraphElement>) => void
            }
            originalMeaning={state.justAdded.meaning}
          />
          <Button
            clicked={() => {
              onDeleteWord(state.justAdded!.id);
              updateState({ justAdded: null });
            }}
          >
            Remove Word
          </Button>
          <Button clicked={onUpdateMeaningClicked}>Update Meaning</Button>
        </Modal>
      ) : null}
      <Modal show={state.showClashTable} modalClosed={dismissClashTable}>
        <h2>Select entry for {state.clashChar}</h2>
        <Table headings={['Pinyin', 'Meaning']}>{clashTableRows}</Table>
      </Modal>
      <Modal show={state.showMeaningInput} modalClosed={dismissMeaningInput}>
        <h3>Word not found - Enter meaning...</h3>
        <Input
          id="meaning"
          value={state.meaning}
          changed={meaningChanged}
          keyPressed={meaningKeyPressed}
        />
        <Button disabled={state.meaningInputDisabled} clicked={meaningSubmitClicked}>
          Submit
        </Button>
      </Modal>
      <Modal show={state.showErrorMessage} modalClosed={dismissModal}>
        <p>{state.errorMessage}</p>
      </Modal>
      <MainBanner
        submitDisabled={state.newWord.length === 0}
        inputChanged={onInputChangedHandler}
        newWord={state.newWord}
        submitClicked={searchForWord}
        loading={state.loading}
      />
      <div className={classes.TableBoxHolder}>{table}</div>
      <Button disabled={words.length === 0} clicked={onTestHandler}>
        Test
      </Button>
      <Button clicked={toggleWords}>{buttonText}</Button>
    </Aux>
  );
};

export default withRouter(connector(AddWords));
