import * as actionTypes from './actionTypes';
import { Word } from '../../types/models';
import {
  AddWordAction,
  AddCustomWordAction,
  RemoveWordAction,
  SetWordsAction,
  FetchWordsFailedAction,
  UpdateMeaningAction,
  AppThunk,
} from '../../types/actions';

export const addWord = (word: Word): AddWordAction => {
  return {
    type: actionTypes.ADD_WORD,
    word: word,
  };
};

export const addCustomWord = (word: Word): AddCustomWordAction => {
  return {
    type: actionTypes.ADD_CUSTOM_WORD,
    word: word,
  };
};

export const removeWord = (wordID: number): RemoveWordAction => {
  return {
    type: actionTypes.REMOVE_WORD,
    wordID: wordID,
  };
};

export const setWords = (words: Word[]): SetWordsAction => {
  return {
    type: actionTypes.SET_WORDS,
    words: words,
  };
};

export const fetchWordsFailed = (): FetchWordsFailedAction => {
  return {
    type: actionTypes.FETCH_WORDS_FAILED,
  };
};

export const initWords = (token: string): AppThunk => {
  return (dispatch) => {
    fetch('/api/get-user-words', {
      headers: {
        'x-access-token': token,
      },
    })
      .then((response) =>
        response
          .json()
          .then((data: { words: Word[] }) => {
            dispatch(setWords(data.words));
          })
          .catch(() => {
            dispatch(fetchWordsFailed());
          })
      )
      .catch(() => {
        dispatch(fetchWordsFailed());
      });
  };
};

export const postWord = (token: string, word: Word): AppThunk => {
  return (dispatch) => {
    fetch('/api/add-word', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(word),
    }).then((response) =>
      response.json().then(() => {
        dispatch(addWord(word));
      })
    );
  };
};

interface CustomWordResponse {
  message: string;
  data: {
    simp: string;
    trad: string;
    pinyin: string;
    meaning: string;
  };
}

export const postCustomWord = (
  token: string,
  word: { simp: string; meaning: string }
): AppThunk => {
  return (dispatch) => {
    fetch('/api/add-custom-word', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(word),
    }).then((response) =>
      response.json().then((data: CustomWordResponse) => {
        if (data.message === 'OK') {
          dispatch(
            addCustomWord({
              id: 0, // Will be assigned by backend
              simp: data.data.simp,
              trad: data.data.trad,
              pinyin: data.data.pinyin,
              meaning: data.data.meaning,
            })
          );
        }
      })
    );
  };
};

export const deleteWord = (token: string, wordID: number): AppThunk => {
  return (dispatch) => {
    fetch('/api/remove-word', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify(wordID),
    }).then((response) =>
      response.json().then(() => {
        dispatch(removeWord(wordID));
      })
    );
  };
};

export const postUpdateMeaning = (
  token: string,
  wordID: number,
  newMeaning: string
): AppThunk => {
  return (dispatch) => {
    fetch('/api/update-word-meaning', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-access-token': token,
      },
      body: JSON.stringify({ word_id: wordID, new_meaning: newMeaning }),
    }).then((response) => {
      if (response.status !== 201) {
        console.log(`Problem. Status Code: ${response.status}`);
        return;
      }
      dispatch(updateMeaning(wordID, newMeaning));
    });
  };
};

export const updateMeaning = (
  wordID: number,
  newMeaning: string
): UpdateMeaningAction => {
  return {
    type: actionTypes.UPDATE_MEANING,
    wordID: wordID,
    newMeaning: newMeaning,
  };
};
