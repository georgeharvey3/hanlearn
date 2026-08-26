import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockCallable, mockReportError } = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockReportError: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockCallable,
}));

vi.mock('../../firebase/config', () => ({
  functions: {},
}));

vi.mock('howler', () => ({
  Howl: class {
    play = vi.fn();
    stop = vi.fn();
  },
}));

vi.mock('../errorReporting', () => ({
  reportError: mockReportError,
}));

import { speak, isGoogleTtsAvailable } from '../ttsService';

// jsdom mocks window.speechSynthesis in setupTests.ts but not the utterance.
class UtteranceStub {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}
vi.stubGlobal('SpeechSynthesisUtterance', UtteranceStub);

/** Let the promise chain inside speak() settle. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('ttsService Google TTS failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the failure that switches the session to the native fallback', async () => {
    const error = new Error('functions/internal');
    mockCallable.mockRejectedValueOnce(error);

    speak('你好');
    await flush();

    expect(mockReportError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ feature: 'tts' }),
    );
  });

  it('still falls back to the native speech synthesis', async () => {
    mockCallable.mockRejectedValueOnce(new Error('functions/internal'));
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');

    speak('你好世界');
    await flush();

    expect(isGoogleTtsAvailable()).toBe(false);
    expect(speakSpy).toHaveBeenCalled();
  });

  it('reports nothing when the call succeeds', async () => {
    mockCallable.mockResolvedValueOnce({ data: { audioContent: btoa('audio') } });

    speak('谢谢');
    await flush();

    expect(mockReportError).not.toHaveBeenCalled();
    expect(isGoogleTtsAvailable()).toBe(true);
  });
});
