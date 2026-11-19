// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { expect } from 'vitest';
import * as vitestAxeMatchers from 'vitest-axe/matchers';

expect.extend(vitestAxeMatchers);

// The full run renders 128 files in parallel, and the first render of a file
// can take more than the default 1 second of a findBy query. The tests then
// fail at random under load and pass alone. 3 seconds stays well under the
// 15-second test timeout.
configure({ asyncUtilTimeout: 3000 });

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
