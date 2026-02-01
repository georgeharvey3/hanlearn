import * as actionTypes  from'./actionTypes';

export const addWord = word => {
    return {
        type: actionTypes.ADD_WORD,
        word: word
    }
}

export const addCustomWord = word => {
    return {
        type: actionTypes.ADD_CUSTOM_WORD,
        word: word
    }
}

export const removeWord = wordID => {
    return {
        type: actionTypes.REMOVE_WORD,
        wordID: wordID
    }
}

export const setWords = words => {
    return {
        type: actionTypes.SET_WORDS,
        words: words
    }
}

export const fetchWordsFailed = () => {
    return {
        type: actionTypes.FETCH_WORDS_FAILED
    }
}

export const initWords = (token) => {
    return dispatch => {
        fetch('/api/get-user-words', {
            headers: {
                'x-access-token': token
            }
        }).then(response =>
            response.json().then(data => {
                dispatch(setWords(data.words));
            })
        .catch(error => {
            dispatch(fetchWordsFailed());
        }))
    }
}


export const postWord = (token, word) => {
    return dispatch => {
        fetch('/api/add-word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(word)
        }).then(response => response.json().then(data => {
            dispatch(addWord(word));
        }));
    }
}

export const postCustomWord = (token, word) => {
    return dispatch => {
        fetch('/api/add-custom-word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(word)
        }).then(response => response.json().then(data => {
            if (data.message === 'OK') {
                dispatch(addCustomWord({
                    simp: data.data.simp,
                    trad: data.data.trad,
                    pinyin: data.data.pinyin,
                    meaning: data.data.meaning
                }));
            }
        }));
    }
}

export const deleteWord = (token, wordID) => {
    return dispatch => {
        fetch('/api/remove-word', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify(wordID)
        }).then(response => response.json().then(data => {
            dispatch(removeWord(wordID));
        }));
    }
}

export const postUpdateMeaning = (token, wordID, newMeaning) => {
    return dispatch => {
        fetch('/api/update-word-meaning', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-access-token': token
            },
            body: JSON.stringify({word_id: wordID, new_meaning:  newMeaning})
        }).then(response => {
            if (response.status !== 201) {
                console.log(`Problem. Status Code: ${response.status}`);
                return;
            }
            dispatch(updateMeaning(wordID, newMeaning));
        }
        );

    }
}

export const updateMeaning = (wordID, newMeaning) => {
    return {
        type: actionTypes.UPDATE_MEANING,
        wordID: wordID,
        newMeaning: newMeaning
    }
}