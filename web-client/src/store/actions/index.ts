export {
  initWords,
  postWord,
  postCustomWord,
  deleteWord,
  postUpdateMeaning,
  finishTest,
} from './word';
export {
  auth,
  logout,
  authCheckState,
  register,
  openAuthModal,
  closeAuthModal,
  setAuthModalMode,
  googleSignIn,
} from './auth';
export { setSpeechAvailable, setSynthAvailable, setVoice, setLang } from './settings';
