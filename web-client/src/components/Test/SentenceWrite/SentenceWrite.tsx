import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Box, Paper, Stack, Typography } from '@mui/material';

import Button from '../../UI/Buttons/Button/Button';
import Input from '../../UI/Input/Input';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Spinner from '../../UI/Spinner/Spinner';
import SimilarityScore from '../../UI/SimilarityScore/SimilarityScore';

import micPic from '../../../assets/images/microphone.png';

import { beep, fail } from '../constants';

import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { getSegmentedSentence } from '../../../services/sentenceService';
import {
  resolveSentence,
  matchEnglishToSentenceWords,
  SentenceWord,
} from '../../../utils/sentenceUtils';
import { parseMeanings } from '../../../utils/meaningUtils';
import { getSimilarityScore } from '../../../services/similarityService';

interface SentenceResult {
  original: string;
  attempt: string;
  english: string;
}

interface SentenceWriteState {
  wordIndex: number;
  charSet: 'simp' | 'trad';
  useChineseSpeechRecognition: boolean;
  useSound: boolean;

  // Fetched Tatoeba sentence
  loading: boolean;
  originalChinese: string | null;
  englishPrompt: string | null;

  // Resolved sentence words for translation lookup
  resolvedWords: SentenceWord[];

  // Translation feature state
  selectedWordIndices: Set<number>;
  translationResults: SentenceWord[];
  showTranslation: boolean;

  // User's attempt
  entered: string;
  submitted: boolean;

  // Results
  results: SentenceResult[];
  message: string;

  // Similarity scoring
  score: number | null;
  scoreLoading: boolean;
}

const mapStateToProps = (state: RootState) => ({
  speechAvailable: state.settings.speechAvailable,
  synthAvailable: state.settings.synthAvailable,
});

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  words: Word[];
  seenOffsets?: Record<string, { offset: number; text: string; english: string }>;
  onComplete?: () => void;
  isDemo?: boolean;
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

/**
 * Strip leading/trailing punctuation from a word for matching purposes.
 */
function stripPunctuation(word: string): string {
  return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

/**
 * Flatten resolved sentence words into a flat array of SentenceWord objects.
 */
function flattenSentenceWords(words: (string | SentenceWord | SentenceWord[])[]): SentenceWord[] {
  const result: SentenceWord[] = [];
  for (const w of words) {
    if (typeof w === 'string') continue;
    if (Array.isArray(w)) {
      result.push(...w);
    } else {
      result.push(w);
    }
  }
  return result;
}

const SentenceWrite: React.FC<Props> = ({
  speechAvailable,
  synthAvailable,
  words,
  seenOffsets,
  onComplete,
  isDemo,
  history,
}) => {
  const [state, setState] = useState<SentenceWriteState>(() => ({
    wordIndex: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    useChineseSpeechRecognition:
      (localStorage.getItem('useChineseSpeechRecognition') !== 'false' || Boolean(isDemo)) &&
      speechAvailable,
    useSound: (localStorage.getItem('useSound') !== 'false' || Boolean(isDemo)) && synthAvailable,
    loading: false,
    originalChinese: null,
    englishPrompt: null,
    resolvedWords: [],
    selectedWordIndices: new Set<number>(),
    translationResults: [],
    showTranslation: false,
    entered: '',
    submitted: false,
    results: [],
    message: '',
    score: null,
    scoreLoading: false,
  }));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceWriteState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearTranslation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedWordIndices: new Set<number>(),
      translationResults: [],
      showTranslation: false,
    }));
  }, []);

  const onHomeClicked = useCallback((): void => {
    history.push('/');
  }, [history]);

  const fetchSentence = useCallback(
    async (wordIndex: number, tryOffset: number): Promise<void> => {
      const word = words[wordIndex];
      if (!word) return;

      updateState({
        loading: true,
        originalChinese: null,
        englishPrompt: null,
        resolvedWords: [],
        selectedWordIndices: new Set<number>(),
        translationResults: [],
        showTranslation: false,
      });

      const seen = seenOffsets?.[word.simp];
      const seenText = seen?.text;
      const seenEnglish = seen?.english;

      const isDuplicate = (chinese: string, english: string): boolean =>
        !!(seenText && chinese === seenText) || !!(seenEnglish && english === seenEnglish);

      const skipToNextWord = (): void => {
        if (wordIndex >= words.length - 1) {
          updateState({ loading: false });
          history.push('/');
        } else {
          const nextIndex = wordIndex + 1;
          const nextOffset = (seenOffsets?.[words[nextIndex].simp]?.offset ?? -1) + 1;
          setState((prev) => ({ ...prev, wordIndex: nextIndex }));
          fetchSentence(nextIndex, nextOffset);
        }
      };

      try {
        const charSet = stateRef.current.charSet;
        const { sentence, totalCount } = await getSegmentedSentence(word.simp, charSet, tryOffset);

        if (!sentence) {
          if (tryOffset === 0) {
            skipToNextWord();
            return;
          }
          const { sentence: fb } = await getSegmentedSentence(word.simp, charSet, 0);
          if (fb && !isDuplicate(fb.chinese.sentence, fb.english.sentence)) {
            const resolved = await resolveSentence(fb);
            updateState({
              loading: false,
              originalChinese: fb.chinese.sentence,
              englishPrompt: fb.english.sentence,
              resolvedWords: flattenSentenceWords(resolved.chinese.words),
            });
          } else {
            skipToNextWord();
          }
          return;
        }

        if (isDuplicate(sentence.chinese.sentence, sentence.english.sentence)) {
          if (tryOffset + 1 < totalCount) {
            fetchSentence(wordIndex, tryOffset + 1);
          } else {
            skipToNextWord();
          }
          return;
        }

        const resolved = await resolveSentence(sentence);
        updateState({
          loading: false,
          originalChinese: sentence.chinese.sentence,
          englishPrompt: sentence.english.sentence,
          resolvedWords: flattenSentenceWords(resolved.chinese.words),
        });
      } catch (error) {
        console.error('Error fetching sentence for SentenceWrite:', error);
        updateState({ loading: false });
      }
    },
    [seenOffsets, updateState, words],
  );

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && words.length > 0) {
      hasInitialized.current = true;
      const firstOffset = (seenOffsets?.[words[0].simp]?.offset ?? -1) + 1;
      fetchSentence(0, firstOffset);
    }
  }, [fetchSentence, seenOffsets, words]);

  const onListenPinyin = useCallback((): void => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';

    updateState({ message: '' });

    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      result = event.results[0][0].transcript;
      updateState({ entered: result, message: '' });
      document.getElementById('answerInput')?.focus();
    });

    recognition.addEventListener('end', () => {
      if (!result) updateState({ message: "Couldn't hear anything..." });
    });

    recognition.addEventListener('audiostart', () => {
      updateState({ message: 'Listening...' });
    });

    recognition.start();
  }, [updateState]);

  const onYesClicked = useCallback((): void => {
    if (stateRef.current.useSound) beep.play();

    const { originalChinese, englishPrompt, entered, wordIndex } = stateRef.current;
    const newResult: SentenceResult = {
      original: originalChinese || '',
      attempt: entered,
      english: englishPrompt || '',
    };

    const nextIndex = wordIndex + 1;
    setState((prev) => ({
      ...prev,
      results: [...prev.results, newResult],
      wordIndex: nextIndex,
      entered: '',
      submitted: false,
      originalChinese: null,
      englishPrompt: null,
      resolvedWords: [],
      selectedWordIndices: new Set<number>(),
      translationResults: [],
      showTranslation: false,
      message: '',
      score: null,
      scoreLoading: false,
    }));

    if (nextIndex < words.length) {
      const nextOffset = (seenOffsets?.[words[nextIndex].simp]?.offset ?? -1) + 1;
      fetchSentence(nextIndex, nextOffset);
    } else {
      onComplete?.();
    }
  }, [fetchSentence, onComplete, seenOffsets, words]);

  const onNoClicked = useCallback((): void => {
    if (stateRef.current.useSound) fail.play();
    setState((prev) => ({
      ...prev,
      entered: '',
      submitted: false,
      message: 'Try again',
      selectedWordIndices: new Set<number>(),
      translationResults: [],
      showTranslation: false,
      score: null,
      scoreLoading: false,
    }));
  }, []);

  const onToggleWord = useCallback((index: number): void => {
    setState((prev) => {
      const next = new Set(prev.selectedWordIndices);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return {
        ...prev,
        selectedWordIndices: next,
        // Hide previous translation when selection changes
        showTranslation: false,
        translationResults: [],
      };
    });
  }, []);

  const onTranslate = useCallback((): void => {
    const { englishPrompt, selectedWordIndices, resolvedWords } = stateRef.current;
    if (!englishPrompt || selectedWordIndices.size === 0) return;

    const englishWords = englishPrompt.split(/\s+/);
    const selectedText = Array.from(selectedWordIndices)
      .sort((a, b) => a - b)
      .map((i) => stripPunctuation(englishWords[i]))
      .filter((w) => w.length > 0)
      .join(' ');

    const matches = matchEnglishToSentenceWords(selectedText, resolvedWords);
    updateState({ translationResults: matches, showTranslation: true });
  }, [updateState]);

  const onKeyUp = useCallback(
    (event: globalThis.KeyboardEvent): void => {
      const sourceElement = (event.target as HTMLElement).tagName.toLowerCase();
      const finished = stateRef.current.wordIndex >= words.length;

      if (event.key === ' ') {
        if (finished) {
          event.preventDefault();
          onHomeClicked();
        } else if (sourceElement !== 'input') {
          onListenPinyin();
        }
      }

      if (event.ctrlKey && event.key === 'm') {
        if (!finished) onListenPinyin();
      }

      if (event.ctrlKey && event.key === 'b') {
        document.getElementById('answerInput')?.focus();
      }

      if (event.key === 'ArrowUp' && stateRef.current.submitted) {
        onYesClicked();
      }

      if (event.key === 'ArrowDown' && stateRef.current.submitted) {
        onNoClicked();
      }
    },
    [onHomeClicked, onListenPinyin, onNoClicked, onYesClicked, words.length],
  );

  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyUp]);

  const onInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || stateRef.current.entered.trim() === '') return;
    document.getElementById('answerInput')?.blur();
    clearTranslation();
    updateState({ submitted: true, message: '', scoreLoading: true, score: null });

    const { originalChinese, entered } = stateRef.current;
    if (originalChinese) {
      getSimilarityScore(entered, originalChinese, 'zh')
        .then((result) => {
          updateState({ score: result.score, scoreLoading: false });
        })
        .catch(() => {
          updateState({ score: null, scoreLoading: false });
        });
    }
  };

  // Loading state
  if (state.loading) {
    return (
      <Box sx={{ width: '90%', maxWidth: 400, textAlign: 'center', mx: 'auto', py: '30px' }}>
        <Spinner />
      </Box>
    );
  }

  const currentWord = words[state.wordIndex];

  const outerSx = {
    width: '90%',
    maxWidth: 520,
    mx: 'auto',
    py: 4,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
  };

  // Comparison view (after submission)
  if (state.submitted) {
    return (
      <Box sx={outerSx}>
        <Typography
          variant="overline"
          sx={{ textAlign: 'center', color: 'text.secondary', letterSpacing: 2, display: 'block' }}
        >
          Write in Chinese
        </Typography>

        <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
          Word {state.wordIndex + 1} of {words.length}
        </Typography>

        <Stack spacing={2} alignItems="center">
          <Stack spacing={1} sx={{ width: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Your answer
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: '12px 16px',
                borderRadius: 2,
                bgcolor: '#f9f9f9',
                textAlign: 'left',
                minHeight: 48,
              }}
            >
              <Typography sx={{ color: 'text.primary', fontSize: '1.1rem', letterSpacing: 1 }}>
                {state.entered || (
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    —
                  </Box>
                )}
              </Typography>
            </Paper>
          </Stack>

          <Stack spacing={1} sx={{ width: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Original
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: '12px 16px',
                borderRadius: 2,
                bgcolor: '#f0f7f4',
                textAlign: 'left',
                minHeight: 48,
              }}
            >
              <Typography sx={{ color: 'text.primary', fontSize: '1.1rem', letterSpacing: 1 }}>
                {state.originalChinese}
              </Typography>
            </Paper>
          </Stack>

          {state.scoreLoading ? (
            <SimilarityScore score={0} loading />
          ) : state.score !== null ? (
            <SimilarityScore score={state.score} />
          ) : (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Score unavailable
            </Typography>
          )}

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button clicked={onYesClicked} aria-label="Next word">
              Next Word
            </Button>
            <Button clicked={onNoClicked} type="secondary" aria-label="Try again">
              Try Again
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  // Split English prompt into tappable words
  const englishWords = state.englishPrompt?.split(/\s+/) || [];

  // Input view
  return (
    <Box sx={outerSx}>
      <Typography
        variant="overline"
        sx={{ textAlign: 'center', color: 'text.secondary', letterSpacing: 2, display: 'block' }}
      >
        Write in Chinese
      </Typography>

      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary' }}>
        Word {state.wordIndex + 1} of {words.length}
      </Typography>

      {/* Prompt card */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: '#fff',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        {/* Tappable English words */}
        <Box
          sx={{
            fontSize: '1.25rem',
            fontWeight: 400,
            lineHeight: 1.8,
            color: 'text.primary',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 0.5,
          }}
        >
          {englishWords.map((word, index) => {
            const isSelected = state.selectedWordIndices.has(index);
            return (
              <Box
                key={index}
                component="span"
                role="button"
                tabIndex={0}
                aria-label={`${word}: tap to select for translation`}
                aria-pressed={isSelected}
                onClick={() => onToggleWord(index)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleWord(index);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  userSelect: 'none',
                  transition: 'background-color 0.15s, color 0.15s',
                  bgcolor: isSelected ? 'primary.main' : 'transparent',
                  color: isSelected ? '#fff' : 'text.primary',
                  '&:hover': {
                    bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                {word}
              </Box>
            );
          })}
        </Box>

        {/* Translate button */}
        {state.selectedWordIndices.size > 0 && (
          <Button clicked={onTranslate} aria-label="Translate selected words">
            Translate
          </Button>
        )}

        {/* Translation results */}
        {state.showTranslation && (
          <Box sx={{ width: '100%' }}>
            {state.translationResults.length > 0 ? (
              <Stack spacing={1}>
                {state.translationResults.map((tw, i) => (
                  <Paper
                    key={`${tw.id}-${i}`}
                    variant="outlined"
                    sx={{
                      p: '8px 12px',
                      borderRadius: 2,
                      bgcolor: '#f0f7f4',
                      textAlign: 'left',
                    }}
                  >
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 500, letterSpacing: 1 }}>
                      {tw[state.charSet]}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {tw.pinyin}
                    </Typography>
                    <Typography variant="body2">{parseMeanings(tw.meaning).join(' / ')}</Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No translation found
              </Typography>
            )}
          </Box>
        )}

        {/* Must-use word badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.5,
            borderRadius: 10,
            bgcolor: 'primary.dark',
            color: '#fff',
          }}
        >
          <Typography variant="caption" sx={{ color: '#fff', lineHeight: 1 }}>
            must use:
          </Typography>
          <Typography
            sx={{
              fontWeight: 400,
              fontSize: '1.1rem',
              letterSpacing: 1,
              lineHeight: 1,
              color: '#fff',
            }}
          >
            {currentWord?.[state.charSet]}
          </Typography>
        </Box>
      </Paper>

      {/* Hint text */}
      <Typography
        variant="caption"
        sx={{ textAlign: 'center', color: 'text.secondary', display: 'block' }}
      >
        Tap English words for translation help
      </Typography>

      {/* Answer input */}
      <Stack spacing={1.5} alignItems="center">
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          Your answer
        </Typography>
        <Input
          id="answerInput"
          aria-label="Type your Chinese answer"
          autoComplete="off"
          changed={(e) => updateState({ entered: e.target.value, message: '' })}
          keyPressed={onInputKeyPress}
          value={state.entered}
          placeholder="Type Chinese and press Enter…"
          style={{ width: '100%' }}
        />
        {state.useChineseSpeechRecognition && (
          <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
            {state.message && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {state.message}
              </Typography>
            )}
            <PictureButton
              type="secondary"
              src={micPic}
              aria-label="Record speech"
              clicked={onListenPinyin}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default withRouter(connector(SentenceWrite));
