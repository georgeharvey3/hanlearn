import * as actionTypes from './actionTypes';
import {
  SetSpeechAvailableAction,
  SetSynthAvailableAction,
  SetVoiceAction,
  SetLangAction,
} from '../../types/actions';

export const setSpeechAvailable = (
  available: boolean
): SetSpeechAvailableAction => {
  return {
    type: actionTypes.SET_SPEECH_AVAILABLE,
    available: available,
  };
};

export const setSynthAvailable = (
  available: boolean
): SetSynthAvailableAction => {
  return {
    type: actionTypes.SET_SYNTH_AVAILABLE,
    available: available,
  };
};

export const setVoice = (voice: SpeechSynthesisVoice): SetVoiceAction => {
  return {
    type: actionTypes.SET_VOICE,
    voice: voice,
  };
};

export const setLang = (lang: string): SetLangAction => {
  return {
    type: actionTypes.SET_LANG,
    lang: lang,
  };
};
