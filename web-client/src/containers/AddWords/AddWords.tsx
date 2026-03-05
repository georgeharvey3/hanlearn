import React, { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import MeaningEditor from '../../components/UI/MeaningEditor/MeaningEditor';

import Modal from '../../components/UI/Modal/Modal';
import MainBanner from '../../components/AddWords/MainBanner';
import Table from '../../components/UI/Table/Table';
import Button from '../../components/UI/Buttons/Button/Button';
import * as wordActions from '../../store/actions/index';
import Remove from '../../components/UI/Table/TableRow/Remove/Remove';
import Spinner from '../../components/UI/Spinner/Spinner';
import Input from '../../components/UI/Input/Input';

import NewWord from '../../components/Test/NewWords/NewWord/NewWord';
import { RootState } from '../../types/store';
import { Word } from '../../types/models';
import * as wordService from '../../services/wordService';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';

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
  pendingWord: Word | null;
  meaning: string;
  meaningInputDisabled: boolean;
  showMeaningInput: boolean;
  showConfirmModal: boolean;
  pendingMeaning: string;
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
      pendingWord: null,
      meaning: '',
      meaningInputDisabled: false,
      showMeaningInput: false,
      showConfirmModal: false,
      pendingMeaning: '',
    };
  });

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

  const dismissConfirmModal = useCallback((): void => {
    updateState({ showConfirmModal: false, pendingWord: null, pendingMeaning: '' });
    const input = document.querySelector('#addInput') as HTMLInputElement | null;
    if (input) {
      input.focus();
    }
  }, [updateState]);

  const confirmAddWord = useCallback((): void => {
    if (!state.pendingWord) return;

    const editedMeaning = state.pendingMeaning.trim();

    if (editedMeaning && editedMeaning !== state.pendingWord.meaning) {
      onPostWord({ ...state.pendingWord, meaning: editedMeaning });
    } else {
      onPostWord(state.pendingWord);
    }

    updateState({ showConfirmModal: false, pendingWord: null, pendingMeaning: '' });
    const input = document.querySelector('#addInput') as HTMLInputElement | null;
    if (input) {
      input.focus();
    }
  }, [state.pendingWord, state.pendingMeaning, onPostWord, updateState]);

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

        if (state.showConfirmModal) {
          dismissConfirmModal();
        }
      }
    },
    [
      dismissClashTable,
      dismissMeaningInput,
      dismissModal,
      dismissConfirmModal,
      state.showClashTable,
      state.showErrorMessage,
      state.showMeaningInput,
      state.showConfirmModal,
    ],
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

  const onInputChangedHandler = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ newWord: event.target.value, addError: false });
  }, [updateState]);

  const handleSearchResult = useCallback((res: Word[], searchedWord: string): void => {
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
      updateState({
        newWord: '',
        pendingWord: word,
        pendingMeaning: word.meaning,
        showConfirmModal: true,
      });
    }

    if (res.length > 1) {
      updateState({
        clashChar: res[0][state.charSet],
        clashWords: res,
        showClashTable: true,
      });
    }
  }, [words, state.charSet, updateState]);

  const searchForWord = useCallback(async (e: React.FormEvent): Promise<void> => {
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
  }, [state.newWord, state.charSet, updateState, handleSearchResult]);

  const onTestHandler = useCallback((): void => {
    // Navigate to test page - practice mode is available there if no words are due
    history.push('/test-words');
  }, [history]);

  const toggleWords = useCallback((): void => {
    setState((prevState) => ({
      ...prevState,
      showWords: !prevState.showWords,
    }));
  }, []);

  const meaningChanged = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    updateState({ meaning: event.target.value });
  }, [updateState]);

  const meaningSubmitClicked = useCallback((): void => {
    onPostCustomWord({
      text: state.newWord,
      meaning: state.meaning,
      charSet: state.charSet,
    });
    updateState({
      showMeaningInput: false,
      meaning: '',
      newWord: '',
    });
    const mainInput = document.querySelector('#addInput') as HTMLInputElement | null;

    if (mainInput) {
      mainInput.focus();
    }
  }, [onPostCustomWord, state.newWord, state.meaning, state.charSet, updateState]);

  const meaningKeyPressed = useCallback((event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      meaningSubmitClicked();
    }
  }, [meaningSubmitClicked]);

  // Wait for auth to initialize before redirecting
  if (!authInitialized) {
    return <Spinner />;
  }
  if (userId === null) {
    return <Redirect to="/" />;
  }

  const tableRows = useMemo(
    () =>
      words.map((row) => (
        <TableRow key={row.id}>
          <TableCell sx={{ textAlign: 'center', fontWeight: 500 }}>{row[state.charSet]}</TableCell>
          <TableCell sx={{ textAlign: 'center' }}>{row.pinyin}</TableCell>
          <TableCell>
            <MeaningEditor
              value={row.meaning}
              onChange={(newMeaning) => onPostMeaningUpdate(row.id, newMeaning)}
              size="small"
            />
          </TableCell>
          <TableCell
            sx={{
              display: { xs: 'none', sm: 'table-cell' },
              textAlign: 'center',
            }}
          >
            {formatRelativeDueDate(row.due_date || '')}
          </TableCell>
          <TableCell sx={{ textAlign: 'center' }}>
            <Remove clicked={() => onDeleteWord(row.id)} />
          </TableCell>
        </TableRow>
      )),
    [words, state.charSet, onPostMeaningUpdate, onDeleteWord],
  );

  let table: React.ReactNode = loading ? <Spinner /> : null;

  if (words) {
    table = (
      <Table headings={['Character(s)', 'Pinyin', 'Meaning', 'Due', 'Remove']}>{tableRows}</Table>
    );
  }

  if (!state.showWords) {
    table = null;
  }

  if (error) {
    table = (
      <Typography sx={{ fontSize: '20px', color: 'error.main' }}>
        Error: Could not fetch words
      </Typography>
    );
  }

  const clashTableRows = useMemo(
    () =>
      state.clashWords.map((word, index) => (
        <TableRow
          key={index}
          hover
          sx={{ cursor: 'pointer' }}
          onClick={() => {
            handleSearchResult([word], word[state.charSet]);
            updateState({
              clashChar: '',
              clashWords: [],
              showClashTable: false,
            });
          }}
        >
          <TableCell>{word.pinyin}</TableCell>
          <TableCell>{word.meaning}</TableCell>
        </TableRow>
      )),
    [state.clashWords, state.charSet, handleSearchResult, updateState],
  );

  const buttonText = state.showWords ? 'Hide Table' : 'Show Table';

  return (
    <>
      {state.pendingWord !== null ? (
        <Modal show={state.showConfirmModal} modalClosed={dismissConfirmModal}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, pr: 3 }}>
            Add to Word Bank?
          </Typography>
          <NewWord
            word={state.pendingWord}
            isDemo={isDemo}
            isAddedWord={true}
            compact
            onMeaningChange={(meaning) => updateState({ pendingMeaning: meaning })}
          />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 1.5,
              mt: 3,
            }}
          >
            <Button clicked={dismissConfirmModal} type="ghost">
              Cancel
            </Button>
            <Button clicked={confirmAddWord} type="primary">
              Add
            </Button>
          </Box>
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
          aria-label="Enter word meaning"
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
      {state.addError && (
        <Typography
          role="alert"
          sx={{ fontSize: '1rem', color: 'error.main', textAlign: 'center', mb: 2 }}
        >
          Could not search for word. Please check your connection and try again.
        </Typography>
      )}
      {words.length > 0 ? (
        <>
          <Box sx={{ mb: 4, '& h3': { color: 'text.primary' } }}>{table}</Box>
          <Button clicked={onTestHandler}>Test</Button>
          <Button type="ghost" clicked={toggleWords}>
            {buttonText}
          </Button>
        </>
      ) : (
        <Typography
          sx={{
            mt: 4,
            fontSize: '1.1rem',
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          Add words to start learning
        </Typography>
      )}
    </>
  );
};

export default withRouter(connector(AddWords));
