import React, { Component, ChangeEvent, KeyboardEvent, FocusEvent } from 'react';
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
  showChengyus: boolean;
  showNewWordModal: boolean;
}

interface OwnProps {
  isDemo?: boolean;
}

const mapStateToProps = (state: RootState) => ({
  words: state.addWords.words,
  error: state.addWords.error,
  loading: state.addWords.loading,
  token: state.auth.token,
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

class AddWords extends Component<Props, AddWordsState> {
  constructor(props: Props) {
    super(props);

    const charSet = (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp';

    this.state = {
      newWord: '',
      errorMessage: '',
      showErrorMessage: false,
      clashChar: '',
      clashWords: [],
      showClashTable: false,
      charSet: charSet,
      loading: false,
      addError: false,
      showWords: false,
      justAdded: null,
      meaning: '',
      meaningInputDisabled: false,
      showMeaningInput: false,
      showChengyus: false,
      showNewWordModal: false,
    };
  }

  componentDidMount = (): void => {
    if (this.props.token !== null) {
      this.props.onInitWords(this.props.token);
    }
    document.addEventListener('keyup', this.onKeyUp);
  };

  componentWillUnmount = (): void => {
    document.removeEventListener('keyup', this.onKeyUp);
  };

  componentDidUpdate = (_: Props, prevState: AddWordsState): void => {
    if (prevState.justAdded?.id !== this.state.justAdded?.id) {
      this.setState({
        showNewWordModal: true,
      });
    }
  };

  onKeyUp = (event: globalThis.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      if (this.state.showErrorMessage) {
        this.dismissModal();
      }

      if (this.state.showClashTable) {
        this.dismissClashTable();
      }

      if (this.state.showMeaningInput) {
        this.dismissMeaningInput();
      }

      if (this.state.showNewWordModal) {
        this.dismissNewWordModal();
      }
    }
  };

  onInputChangedHandler = (event: ChangeEvent<HTMLInputElement>): void => {
    this.setState({ newWord: event.target.value });
  };

  onShowChengyusClicked = (): void => {
    this.setState((prevState) => ({
      showChengyus: !prevState.showChengyus,
    }));
  };

  dismissModal = (): void => {
    this.setState({
      showErrorMessage: false,
      newWord: '',
    });
  };

  dismissClashTable = (): void => {
    this.setState({
      showClashTable: false,
      newWord: '',
    });
  };

  dismissNewWordModal = (): void => {
    this.setState({
      showNewWordModal: false,
    });
    const input = document.querySelector('#addInput') as HTMLInputElement | null;
    if (input) {
      input.focus();
    }
  };

  handleSearchResult = (res: Word[], searchedWord: string): void => {
    if (res.length === 0) {
      (document.getElementById('addInput') as HTMLInputElement | null)?.blur();
      this.setState({
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
      for (let i = 0; i < this.props.words.length; i++) {
        if (this.props.words[i].id === word.id) {
          this.setState({
            errorMessage: `The word ${searchedWord} is already in your bank`,
            showErrorMessage: true,
          });
          return;
        }
      }
      this.props.onPostWord(this.props.token!, word);
      this.setState({ newWord: '', justAdded: word });
    }

    if (res.length > 1) {
      this.setState({
        clashChar: res[0][this.state.charSet],
        clashWords: res,
        showClashTable: true,
      });
    }
  };

  searchForWord = (e: React.FormEvent): void => {
    e.preventDefault();
    if (this.state.newWord === '') {
      return;
    }

    this.setState({
      loading: true,
    });
    fetch(`/api/get-word/${this.state.newWord}/${this.state.charSet}`).then((response) => {
      if (response.ok) {
        response.json().then((data: { words: Word[] }) => {
          this.setState({
            loading: false,
            addError: false,
          });
          this.handleSearchResult(data.words, this.state.newWord);
        });
      } else {
        this.setState({
          loading: false,
          addError: true,
          newWord: '',
        });
      }
    });
  };

  onMeaningKeyPress = (e: KeyboardEvent<HTMLTableCellElement>, wordID: number): void => {
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
    this.props.onPostMeaningUpdate(this.props.token!, wordID, newMeaning);
    (e.target as HTMLElement).blur();
  };

  onBlurMeaning = (e: FocusEvent<HTMLTableCellElement>): void => {
    (e.target as HTMLElement).textContent = (e.target as HTMLElement).dataset.orig || '';
  };

  onTestHandler = (): void => {
    const anyDue = this.props.words.some((word) => new Date(word.due_date || '') <= new Date());
    const anyWords = this.props.words.length > 0;

    if (anyDue) {
      this.props.history.push('/test-words');
    } else {
      if (!anyWords) {
        this.setState({
          showErrorMessage: true,
          errorMessage: "You don't have any words yet!",
        });
      } else {
        this.setState({
          showErrorMessage: true,
          errorMessage: 'You are up to date!',
        });
      }
    }
  };

  convertDateString = (initial: string): string => {
    const year = initial.slice(0, 4);
    const month = initial.slice(5, 7);
    const day = initial.slice(8);

    return [day, month, year].join('/');
  };

  toggleWords = (): void => {
    this.setState((prevState) => ({ showWords: !prevState.showWords }));
  };

  dismissMeaningInput = (): void => {
    this.setState(() => ({ showMeaningInput: false, newWord: '' }));
    const mainInput = document.querySelector('#addInput') as HTMLInputElement | null;

    if (mainInput) {
      mainInput.focus();
    }
  };

  meaningChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    this.setState(() => ({ meaning: event.target.value }));
  };

  meaningKeyPressed = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      this.meaningSubmitClicked();
    }
  };

  meaningSubmitClicked = (): void => {
    const customWord = {
      simp: this.state.newWord,
      meaning: this.state.meaning,
    } as Word;

    this.props.onPostCustomWord(this.props.token!, customWord);
    this.setState({
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

  onUpdateMeaningClicked = (): void => {
    const meaningElement = document.querySelector('[data-new-word-meaning]') as HTMLElement | null;

    if (!meaningElement) {
      return;
    }

    meaningElement.focus();
  };

  render(): React.ReactNode {
    if (this.props.token === null) {
      return <Redirect to="/" />;
    }

    let table: React.ReactNode = this.props.loading ? <Spinner /> : null;

    const allWords = this.props.words;
    let tableWords: Word[];

    if (this.state.showChengyus) {
      tableWords = allWords.filter((word) => word.simp.length >= 4);
    } else {
      tableWords = allWords.filter((word) => word.simp.length < 4);
    }

    if (tableWords) {
      const tableRows = tableWords.map((row, index) => {
        return (
          <tr key={index}>
            <td>{row[this.state.charSet]}</td>
            <td>{row.pinyin}</td>
            <td
              contentEditable={true}
              suppressContentEditableWarning={true}
              onKeyPress={(e: KeyboardEvent<HTMLTableCellElement>) =>
                this.onMeaningKeyPress(e, row.id)
              }
              onBlur={this.onBlurMeaning}
              data-orig={row.meaning}
            >
              {row.meaning}
            </td>
            <td className="Disappear">{this.convertDateString(row.due_date || '')}</td>
            <td>
              <Remove clicked={() => this.props.onDeleteWord(this.props.token!, row.id)} />
            </td>
          </tr>
        );
      });

      table = (
        <Aux>
          <Button clicked={this.onShowChengyusClicked}>
            {this.state.showChengyus ? 'Show words' : 'Show chengyus'}
          </Button>
          <Table headings={['Character(s)', 'Pinyin', 'Meaning', 'Due Date (D/M/Y)', 'Remove']}>
            {tableRows}
          </Table>
        </Aux>
      );
    }

    if (!this.state.showWords) {
      table = null;
    }

    if (this.props.error) {
      table = (
        <p style={{ fontSize: '20px', color: '#E6E0AE' }}>Error: Could not fetch words</p>
      );
    }

    if (this.state.addError) {
      table = (
        <p style={{ fontSize: '20px', color: '#E6E0AE' }}>Error: Could not search for word</p>
      );
    }

    let clashTableRows: React.ReactNode = null;

    if (this.state.clashWords.length > 0) {
      clashTableRows = this.state.clashWords.map((word, index) => {
        return (
          <tr
            key={index}
            className="Hoverable"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              this.handleSearchResult([word], word[this.state.charSet]);
              this.setState({
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

    const buttonText = this.state.showWords ? 'Hide Table' : 'Show Table';

    return (
      <Aux>
        {this.state.justAdded !== null ? (
          <Modal show={this.state.showNewWordModal} modalClosed={this.dismissNewWordModal}>
            <h2>Just added</h2>
            <NewWord
              word={this.state.justAdded}
              isDemo={this.props.isDemo}
              isAddedWord={true}
              meaningKeyPressed={(e: KeyboardEvent<HTMLParagraphElement>) =>
                this.onMeaningKeyPress(
                  e as unknown as KeyboardEvent<HTMLTableCellElement>,
                  this.state.justAdded!.id
                )
              }
              meaningBlurred={
                this.onBlurMeaning as unknown as (e: FocusEvent<HTMLParagraphElement>) => void
              }
              originalMeaning={this.state.justAdded.meaning}
            />
            <Button
              clicked={() => {
                this.props.onDeleteWord(this.props.token!, this.state.justAdded!.id);
                this.setState({ justAdded: null });
              }}
            >
              Remove Word
            </Button>
            <Button clicked={this.onUpdateMeaningClicked}>Update Meaning</Button>
          </Modal>
        ) : null}
        <Modal show={this.state.showClashTable} modalClosed={this.dismissClashTable}>
          <h2>Select entry for {this.state.clashChar}</h2>
          <Table headings={['Pinyin', 'Meaning']}>{clashTableRows}</Table>
        </Modal>
        <Modal show={this.state.showMeaningInput} modalClosed={this.dismissMeaningInput}>
          <h3>Word not found - Enter meaning...</h3>
          <Input
            id="meaning"
            value={this.state.meaning}
            changed={this.meaningChanged}
            keyPressed={this.meaningKeyPressed}
          />
          <Button disabled={this.state.meaningInputDisabled} clicked={this.meaningSubmitClicked}>
            Submit
          </Button>
        </Modal>
        <Modal show={this.state.showErrorMessage} modalClosed={this.dismissModal}>
          <p>{this.state.errorMessage}</p>
        </Modal>
        <MainBanner
          submitDisabled={this.state.newWord.length === 0}
          inputChanged={this.onInputChangedHandler}
          newWord={this.state.newWord}
          submitClicked={this.searchForWord}
          loading={this.state.loading}
        />
        <div className={classes.TableBoxHolder}>{table}</div>
        <Button disabled={this.props.words.length === 0} clicked={this.onTestHandler}>
          Test
        </Button>
        <Button clicked={this.toggleWords}>{buttonText}</Button>
      </Aux>
    );
  }
}

export default withRouter(connector(AddWords));
