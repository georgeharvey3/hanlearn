import * as actionTypes from '../actions/actionTypes';

const initialState = {
    words: [],
    error: false,
    loading: false
}

const reducer = (state=initialState, action) => {
    switch (action.type) {
        case actionTypes.ADD_WORD:
            let word = action.word;
            let today = new Date();
            if (state.words.length > 9) {
                today.setDate(today.getDate() + 1);
            }
            let todayDay = today.getDate() >= 10 ? today.getDate().toString() : "0" + today.getDate().toString();
            let todayMonth = today.getMonth() >= 9 ? (today.getMonth() + 1).toString() : "0" + (today.getMonth() + 1).toString();
            let todayYear = today.getFullYear().toString();
            let todayString = todayYear + "/" + todayMonth + "/" + todayDay;
            word.due_date = todayString;
            word.bank = 1;

            return {
                ...state,
                words: [action.word].concat(state.words)
            }
        case actionTypes.ADD_CUSTOM_WORD:
            let customWord = action.word;
            let todayCustom = new Date();

            let todayDayCustom = todayCustom.getDate() >= 10 ? todayCustom.getDate().toString() : "0" + todayCustom.getDate().toString();
            let todayMonthCustom = todayCustom.getMonth() >= 9 ? (todayCustom.getMonth() + 1).toString() : "0" + (todayCustom.getMonth() + 1).toString();
            let todayYearCustom = todayCustom.getFullYear().toString();
            let todayStringCustom = todayYearCustom + "/" + todayMonthCustom + "/" + todayDayCustom;
            customWord.due_date = todayStringCustom;
            customWord.bank = 1;

            return {
                ...state,
                words: [action.word].concat(state.words)
            }

        case actionTypes.REMOVE_WORD:
            let newWords = state.words.slice();
            for (let i = 0; i < newWords.length; i ++) {
                if (newWords[i].id === action.wordID) {
                    newWords.splice(i, 1);
                    break;
                }
            }
            return {
                ...state,
                words: newWords
            }
        case actionTypes.UPDATE_MEANING:
            let newWordsMeaning = state.words.slice();
            for (let i = 0; i < newWordsMeaning.length; i ++) {
                if (newWordsMeaning[i].id === action.wordID) {
                    newWordsMeaning[i].meaning = action.newMeaning
                }
            }
            return {
                ...state,
                words: newWordsMeaning
            }
        case actionTypes.CLEAR_WORDS:
            return {
                ...state,
                words: []
            }
        case actionTypes.FETCH_WORDS:
            return {
                ...state,
                loading: true
            }
        case actionTypes.SET_WORDS:
            return {
                ...state,
                words: action.words,
                error: false,
                loading: false
            }
        case actionTypes.FETCH_WORDS_FAILED:
            return {
                ...state,
                error: true,
                loading: false
            }
        default:
            return state;
    }
}

export default reducer;