import * as actionTypes from '../actions/actionTypes';
import { SettingsState } from '../../types/store';
import { SettingsAction } from '../../types/actions';

const initialState: SettingsState = {
  speechAvailable: true,
  synthAvailable: true,
};

const reducer = (
  state = initialState,
  action: SettingsAction
): SettingsState => {
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
