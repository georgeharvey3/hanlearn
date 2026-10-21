import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { toneMarks } from '../../../utils/pinyinMarks';
import SimilarityScore from '../../UI/SimilarityScore/SimilarityScore';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';
import { MicButton, Overline, StatusLine, StudyButton, StudyCard, hanziSx } from '../Study/parts';

import { beep } from '../constants';

import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { getSegmentedSentence, takeSentenceStart } from '../../../services/sentenceService';
import {
  resolveSentence,
  matchEnglishToSentenceWords,
  SentenceWord,
} from '../../../utils/sentenceUtils';
import { parseMeanings } from '../../../utils/meaningUtils';
import { getSimilarityScore } from '../../../services/similarityService';
import { reportError } from '../../../services/errorReporting';

interface SentenceResult {
  original: string;
  attempt: string;
  english: string;
}

interface SentenceWriteState {
  wordIndex: number;
  charSet: 'simp' | 'trad';
  useSound: boolean;

  // Fetched Tatoeba sentence
  loading: boolean;
  // The sentence for the current word could not be fetched
  loadError: boolean;
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
  recognition: SpeechRecognition | null;
  listening: boolean;

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
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad',
    useSound: (localStorage.getItem('useSound') !== 'false' || Boolean(isDemo)) && synthAvailable,
    loading: false,
    loadError: false,
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
    recognition: null,
    listening: false,
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

  // The sentence after the one Read showed, or the word's next rotation start
  // when Read did not run, so Write varies from session to session too.
  const startOffset = useCallback(
    (simp: string): number => {
      const seen = seenOffsets?.[simp];
      return seen ? seen.offset + 1 : takeSentenceStart(simp);
    },
    [seenOffsets],
  );

  const fetchSentence = useCallback(
    async (wordIndex: number, tryOffset: number): Promise<void> => {
      const word = words[wordIndex];
      if (!word) return;

      updateState({
        loading: true,
        loadError: false,
        message: '',
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
          if (onComplete) onComplete();
          else history.push('/');
        } else {
          const nextIndex = wordIndex + 1;
          const nextOffset = startOffset(words[nextIndex].simp);
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
        reportError(error, {
          feature: 'sentence-write',
          context: { wordIndex, wordCount: words.length, offset: tryOffset },
        });
        updateState({ loading: false, loadError: true });
      }
    },
    [history, onComplete, seenOffsets, startOffset, updateState, words],
  );

  const offsetFor = useCallback(
    (index: number): number => startOffset(words[index].simp),
    [startOffset, words],
  );

  const onRetryLoad = useCallback((): void => {
    const { wordIndex } = stateRef.current;
    fetchSentence(wordIndex, offsetFor(wordIndex));
  }, [fetchSentence, offsetFor]);

  // Leave out a word whose sentence will not load, so one failure never
  // strands the learner on this stage.
  const onSkipWord = useCallback((): void => {
    const nextIndex = stateRef.current.wordIndex + 1;
    updateState({ loadError: false, entered: '', message: '' });
    if (nextIndex < words.length) {
      setState((prev) => ({ ...prev, wordIndex: nextIndex }));
      fetchSentence(nextIndex, offsetFor(nextIndex));
    } else {
      updateState({ wordIndex: nextIndex });
      onComplete?.();
    }
  }, [fetchSentence, offsetFor, onComplete, updateState, words.length]);

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && words.length > 0) {
      hasInitialized.current = true;
      const firstOffset = startOffset(words[0].simp);
      fetchSentence(0, firstOffset);
    }
  }, [fetchSentence, startOffset, words]);

  const onListenPinyin = useCallback((): void => {
    stateRef.current.recognition?.abort();
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';

    updateState({ message: '', recognition });

    let result: string | undefined;

    recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
      result = event.results[0][0].transcript;
      updateState({ entered: result, message: '' });
      document.getElementById('answerInput')?.focus();
    });

    recognition.addEventListener('end', () => {
      updateState({ listening: false });
      if (!result) updateState({ message: copy.test.status.heardNothing });
    });

    recognition.addEventListener('audiostart', () => {
      updateState({ message: copy.test.status.listening, listening: true });
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
      const nextOffset = startOffset(words[nextIndex].simp);
      fetchSentence(nextIndex, nextOffset);
    } else {
      onComplete?.();
    }
  }, [fetchSentence, onComplete, startOffset, words]);

  // A tapped English word shows the Chinese for the words selected so far.
  const onToggleWord = useCallback((index: number): void => {
    setState((prev) => {
      const next = new Set(prev.selectedWordIndices);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      if (!prev.englishPrompt || next.size === 0) {
        return {
          ...prev,
          selectedWordIndices: next,
          showTranslation: false,
          translationResults: [],
        };
      }
      const englishWords = prev.englishPrompt.split(/\s+/);
      const selectedText = Array.from(next)
        .sort((a, b) => a - b)
        .map((i) => stripPunctuation(englishWords[i]))
        .filter((w) => w.length > 0)
        .join(' ');
      return {
        ...prev,
        selectedWordIndices: next,
        translationResults: matchEnglishToSentenceWords(selectedText, prev.resolvedWords),
        showTranslation: true,
      };
    });
  }, []);

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
    },
    [onHomeClicked, onListenPinyin, onYesClicked, words.length],
  );

  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyUp]);

  const onSubmitAnswer = (): void => {
    if (stateRef.current.entered.trim() === '') return;
    document.getElementById('answerInput')?.blur();
    clearTranslation();
    updateState({ submitted: true, message: '', scoreLoading: true, score: null });

    const { originalChinese, entered } = stateRef.current;
    if (originalChinese) {
      getSimilarityScore(entered, originalChinese, 'zh')
        .then((result) => {
          updateState({ score: result.score, scoreLoading: false });
        })
        .catch((error) => {
          reportError(error, { feature: 'sentence-score', context: { language: 'zh' } });
          updateState({ score: null, scoreLoading: false });
        });
    }
  };

  const onInputKeyPress = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return;
    onSubmitAnswer();
  };

  const onEnd = (): void => {
    stateRef.current.recognition?.abort();
    history.push('/');
  };

  const currentWord = words[state.wordIndex];
  const target = currentWord?.[state.charSet] ?? '';
  const isLastWord = state.wordIndex >= words.length - 1;
  const top = (
    <StudyTop
      stage={copy.study.stageWrite}
      done={Math.min(state.wordIndex + (state.submitted ? 1 : 0), words.length)}
      position={Math.min(state.wordIndex + 1, words.length)}
      total={words.length}
      onEnd={onEnd}
    />
  );

  // A line of Chinese with each use of the word under study highlighted.
  const withTarget = (text: string): React.ReactNode =>
    target === ''
      ? text
      : text.split(target).flatMap((part, i) =>
          i === 0
            ? [part]
            : [
                <Box
                  component="span"
                  key={i}
                  sx={{
                    color: colors.primaryDark,
                    bgcolor: colors.successSurface,
                    borderRadius: '3px',
                    px: '3px',
                  }}
                >
                  {target}
                </Box>,
                part,
              ],
        );

  const mustUse = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Overline component="span">{copy.sentence.mustUse}</Overline>
      <Box
        component="span"
        lang="zh"
        sx={{
          px: 1.25,
          py: 0.5,
          border: `2px solid ${colors.primaryLight}`,
          borderRadius: '3px',
          color: colors.primaryLight,
          ...hanziSx(26, { lineHeight: 1.1 }),
        }}
      >
        {target}
      </Box>
    </Box>
  );

  if (state.loading) {
    return (
      <StudyScreen>
        {top}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress aria-label={copy.study.loading} sx={{ color: colors.primaryDark }} />
        </Box>
      </StudyScreen>
    );
  }

  if (state.loadError) {
    return (
      <StudyScreen>
        {top}
        <Box
          sx={{
            mt: 2.5,
            height: 300,
            boxSizing: 'border-box',
            p: 3,
            bgcolor: colors.card,
            border: `1px dashed ${colors.borderStrong}`,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.75,
            textAlign: 'center',
          }}
        >
          <Box lang="zh" sx={hanziSx(48, { color: colors.disabledText })}>
            {target}
          </Box>
          <Box role="alert" sx={{ fontSize: 17, fontWeight: 600 }}>
            {copy.sentence.loadFailed}
          </Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        <StudyButton onClick={onSkipWord}>
          {isLastWord ? copy.sentence.skipAndFinish : copy.sentence.skipWord}
        </StudyButton>
        <StudyButton variant="primary" onClick={onRetryLoad} sx={{ mt: 1.25 }}>
          {copy.sentence.tryAgain}
        </StudyButton>
      </StudyScreen>
    );
  }

  const answerBox = {
    p: 1.75,
    border: `1px solid ${colors.divider}`,
    borderRadius: 1,
    bgcolor: colors.card,
    fontFamily: fonts.hanzi,
    fontSize: 26,
    lineHeight: 1.4,
    minHeight: 48,
  };

  if (state.submitted) {
    return (
      <StudyScreen>
        {top}
        <Box
          sx={{
            mt: 2.5,
            px: 2.5,
            py: 2,
            bgcolor: colors.card,
            border: `1px solid ${colors.divider}`,
            borderRadius: 1,
            fontSize: 18,
            textAlign: 'center',
            color: colors.textSecondary,
          }}
        >
          {state.englishPrompt}
        </Box>
        <Overline sx={{ mt: 2.75, mb: 0.75 }}>{copy.sentence.yourAnswer}</Overline>
        <Box lang="zh" sx={answerBox}>
          {withTarget(state.entered)}
        </Box>
        <Overline sx={{ mt: 2, mb: 0.75 }}>{copy.sentence.original}</Overline>
        <Box lang="zh" sx={answerBox}>
          {withTarget(state.originalChinese ?? '')}
        </Box>
        <Box sx={{ mt: 2.75 }}>
          {state.scoreLoading ? (
            <SimilarityScore score={0} loading />
          ) : state.score !== null ? (
            <SimilarityScore score={state.score} />
          ) : (
            <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
              {copy.sentence.scoreUnavailable}
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, minHeight: 24 }} />
        <StudyButton variant="primary" onClick={onYesClicked}>
          {isLastWord ? copy.sentence.finish : copy.sentence.nextWord}
        </StudyButton>
      </StudyScreen>
    );
  }

  // The English prompt, one button per word: a tapped word shows its Chinese.
  const englishWords = state.englishPrompt?.split(/\s+/) || [];

  return (
    <StudyScreen>
      {top}
      <StudyCard
        seal={false}
        height={240}
        sx={{ mt: 3, px: 2.75, pt: 3.5, pb: 2.75, gap: state.showTranslation ? 2.25 : 2.75 }}
      >
        <Box component="p" sx={{ m: 0, fontSize: 24, lineHeight: 1.6 }}>
          {englishWords.map((word, index) => {
            const selected = state.selectedWordIndices.has(index);
            return (
              <React.Fragment key={index}>
                {index > 0 && ' '}
                <Box
                  component="button"
                  type="button"
                  aria-label={copy.sentence.englishWord(word)}
                  aria-pressed={selected}
                  onClick={() => onToggleWord(index)}
                  sx={{
                    border: 'none',
                    p: selected ? '0 6px' : '0 2px',
                    font: 'inherit',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    bgcolor: selected ? colors.primaryDark : 'transparent',
                    color: selected ? colors.white : 'inherit',
                    borderBottom: selected ? 'none' : `1px dotted ${colors.borderStrong}`,
                  }}
                >
                  {word}
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
        {state.showTranslation && (
          <Box
            sx={{
              alignSelf: 'stretch',
              display: 'flex',
              flexDirection: 'column',
              borderTop: `1px solid ${colors.divider}`,
              textAlign: 'left',
            }}
          >
            {state.translationResults.length > 0 ? (
              state.translationResults.map((tw, i) => (
                <Box
                  key={`${tw.id}-${i}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.75,
                    py: 1.25,
                    px: 0.25,
                    borderBottom:
                      i === state.translationResults.length - 1
                        ? 'none'
                        : `1px solid ${colors.divider}`,
                  }}
                >
                  <Box lang="zh" sx={hanziSx(30, { width: 64, flex: 'none' })}>
                    {tw[state.charSet]}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Box lang="zh-Latn" sx={{ fontSize: 15 }}>
                      {toneMarks(tw.pinyin)}
                    </Box>
                    <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
                      {parseMeanings(tw.meaning).join(' · ')}
                    </Box>
                  </Box>
                </Box>
              ))
            ) : (
              <Box sx={{ pt: 1.25, fontSize: 14, color: colors.textSecondary }}>
                {copy.sentence.noTranslation}
              </Box>
            )}
          </Box>
        )}
        {mustUse}
      </StudyCard>
      {speechAvailable && (
        <MicButton
          listening={state.listening}
          onClick={() => (state.listening ? state.recognition?.abort() : onListenPinyin())}
          sx={{ mt: 2.75 }}
        />
      )}
      {state.message && (
        <StatusLine
          tone="neutral"
          icon={state.message === copy.test.status.listening ? 'dot' : undefined}
        >
          {state.message}
        </StatusLine>
      )}
      <Overline component="label" htmlFor="answerInput" sx={{ mt: 2.5 }}>
        {copy.sentence.yourAnswer}
      </Overline>
      <Box
        component="input"
        id="answerInput"
        lang="zh"
        autoComplete="off"
        value={state.entered}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          updateState({ entered: e.target.value, message: '' })
        }
        onKeyPress={onInputKeyPress}
        placeholder={copy.sentence.writePlaceholder}
        sx={{
          mt: 1,
          height: 48,
          boxSizing: 'border-box',
          borderRadius: 1,
          border: `1px solid ${colors.borderStrong}`,
          bgcolor: colors.card,
          px: 1.75,
          fontFamily: fonts.hanzi,
          fontSize: 22,
          color: colors.text,
          outline: 'none',
          '&:focus': { border: `2px solid ${colors.primaryDark}`, px: '13px' },
          '&::placeholder': { color: colors.placeholder },
        }}
      />
      <Box sx={{ flex: 1, minHeight: 24 }} />
      <StudyButton
        variant="primary"
        disabled={state.entered.trim() === ''}
        onClick={onSubmitAnswer}
      >
        {copy.test.check}
      </StudyButton>
    </StudyScreen>
  );
};

export default withRouter(connector(SentenceWrite));
