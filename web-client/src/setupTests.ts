// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Web Speech API (not available in jsdom)
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    getVoices: () => [],
    speak: () => {},
    cancel: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
});

Object.defineProperty(window, 'SpeechRecognition', {
  value: undefined,
  writable: true,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: undefined,
  writable: true,
});
