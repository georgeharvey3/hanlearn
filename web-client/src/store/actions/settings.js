import * as actionTypes from "./actionTypes";

export const setSpeechAvailable = (available) => {
  return {
    type: actionTypes.SET_SPEECH_AVAILABLE,
    available: available,
  };
};

export const setSynthAvailable = (available) => {
  return {
    type: actionTypes.SET_SYNTH_AVAILABLE,
    available: available,
  };
};

export const setVoice = (voice) => {
  return {
    type: actionTypes.SET_VOICE,
    voice: voice,
  };
};

export const setLang = (lang) => {
  return {
    type: actionTypes.SET_LANG,
    lang: lang,
  };
};
