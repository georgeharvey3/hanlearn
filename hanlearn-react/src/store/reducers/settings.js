import * as actionTypes from "../actions/actionTypes";

const initialState = {
  speechAvailable: true,
  synthAvailable: true,
};

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.SET_SPEECH_AVAILABLE:
      return {
        ...state,
        speechAvailable: action.available,
      };
    case actionTypes.SET_SYNTH_AVAILABLE:
      return {
        ...state,
        synthAvailable: action.available,
      };
    case actionTypes.SET_VOICE:
      return {
        ...state,
        voice: action.voice,
      };
    case actionTypes.SET_LANG:
      return {
        ...state,
        lang: action.lang,
      };
    default:
      return state;
  }
};

export default reducer;
