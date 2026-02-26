import React, { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Howl } from 'howler';
import { httpsCallable } from 'firebase/functions';

import { Box, Paper, Stack, Typography } from '@mui/material';

import Button from '../../UI/Buttons/Button/Button';
import Input from '../../UI/Input/Input';
import PictureButton from '../../UI/Buttons/PictureButton/PictureButton';
import Modal from '../../UI/Modal/Modal';
import Spinner from '../../UI/Spinner/Spinner';
import Table from '../../UI/Table/Table';
import TableRow from '../../UI/Table/TableRow/TableRow';

import micPic from '../../../assets/images/microphone.png';
import likePic from '../../../assets/images/like.png';
import dislikePic from '../../../assets/images/dislike.png';

import successSound from '../../../assets/sounds/success1.wav';
import failSound from '../../../assets/sounds/failure1.wav';

import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { functions } from '../../../firebase/config';

import pinyin from 'pinyin';

// Reuse the same cloud function as SentenceRead
const getSentenceFromCloud = httpsCallable<
  { word: string; offset: number },
  { sentence: { chinese: { sentence: string }; english: { sentence: string } } | null; totalCount: number }
>(functions, 'getSentences');

const beep = new Howl({ src: [successSound], volume: 0.5 });
const fail = new Howl({ src: [failSound], volume: 0.7 });

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

  // User's attempt
  entered: string;
  submitted: boolean;

  // Results
  results: SentenceResult[];
  message: string;
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
}

type Props = PropsFromRedux & OwnProps & RouteComponentProps;

const SentenceWrite: React.FC<Props> = ({
  speechAvailable,
  synthAvailable,
  words,
  seenOffsets,
  history,
}) => {
  const [state, setState] = useState<SentenceWriteState>(() => ({
    wordIndex: 0,
    charSet: (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
    useChineseSpeechRecognition:
      localStorage.getItem('useChineseSpeechRecognition') === 'false' || !speechAvailable
        ? false
        : true,
    useSound: localStorage.getItem('useSound') === 'false' || !synthAvailable ? false : true,
    loading: false,
    originalChinese: null,
    englishPrompt: null,
    entered: '',
    submitted: false,
    results: [],
    message: '',
  }));

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback((partial: Partial<SentenceWriteState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const onHomeClicked = useCallback((): void => {
    history.push('/');
  }, [history]);

  const fetchSentence = useCallback(
    async (wordIndex: number, tryOffset: number): Promise<void> => {
      const word = words[wordIndex];
      if (!word) return;

      updateState({ loading: true, originalChinese: null, englishPrompt: null });

      const seen = seenOffsets?.[word.simp];
      const seenText = seen?.text;
      const seenEnglish = seen?.english;

      const isDuplicate = (chinese: string, english: string): boolean =>
        !!(seenText && chinese === seenText) || !!(seenEnglish && english === seenEnglish);

      const skipToNextWord = (): void => {
        if (wordIndex >= words.length - 1) {
          updateState({ loading: false, wordIndex: words.length });
        } else {
          const nextIndex = wordIndex + 1;
          const nextOffset = (seenOffsets?.[words[nextIndex].simp]?.offset ?? -1) + 1;
          setState((prev) => ({ ...prev, wordIndex: nextIndex }));
          fetchSentence(nextIndex, nextOffset);
        }
      };

      try {
        const result = await getSentenceFromCloud({ word: word.simp, offset: tryOffset });
        const { sentence, totalCount } = result.data;

        if (!sentence) {
          if (tryOffset === 0) {
            // No sentences at all for this word — skip
            skipToNextWord();
            return;
          }
          // No sentence at tryOffset — fall back to offset 0
          const fallback = await getSentenceFromCloud({ word: word.simp, offset: 0 });
          const fb = fallback.data.sentence;
          if (fb && !isDuplicate(fb.chinese.sentence, fb.english.sentence)) {
            updateState({ loading: false, originalChinese: fb.chinese.sentence, englishPrompt: fb.english.sentence });
          } else {
            skipToNextWord();
          }
          return;
        }

        // Skip if this sentence was already seen in SentenceRead (matched by Chinese or English text)
        if (isDuplicate(sentence.chinese.sentence, sentence.english.sentence)) {
          if (tryOffset + 1 < totalCount) {
            fetchSentence(wordIndex, tryOffset + 1);
          } else {
            skipToNextWord();
          }
          return;
        }

        updateState({
          loading: false,
          originalChinese: sentence.chinese.sentence,
          englishPrompt: sentence.english.sentence,
        });
      } catch (error) {
        console.error('Error fetching sentence for SentenceWrite:', error);
        updateState({ loading: false });
      }
    },
    [seenOffsets, updateState, words]
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
      message: '',
    }));

    if (nextIndex < words.length) {
      const nextOffset = (seenOffsets?.[words[nextIndex].simp]?.offset ?? -1) + 1;
      fetchSentence(nextIndex, nextOffset);
    }
  }, [fetchSentence, seenOffsets, words]);

  const onNoClicked = useCallback((): void => {
    if (stateRef.current.useSound) fail.play();
    updateState({ entered: '', submitted: false, message: 'Try again' });
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
    [onHomeClicked, onListenPinyin, onNoClicked, onYesClicked, words.length]
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
    updateState({ submitted: true, message: '' });
  };

  // Summary screen
  if (state.wordIndex >= words.length && state.results.length > 0) {
    const headings = ['Original', 'Your attempt', 'Pinyin', 'English'];

    const rows = state.results.map((result, index) => (
      <TableRow key={index}>
        {[result.original, result.attempt, pinyin(result.original).join(' '), result.english]}
      </TableRow>
    ));

    return (
      <Modal show>
        <Typography variant="h5" component="h2">Finished!</Typography>
        <Table headings={headings}>{rows}</Table>
        <Button clicked={onHomeClicked}>Home</Button>
      </Modal>
    );
  }

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

        <Stack spacing={2} alignItems="center">
          <Stack spacing={1} sx={{ width: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Your answer
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: '12px 16px', borderRadius: 2, bgcolor: '#f9f9f9', textAlign: 'left', minHeight: 48 }}
            >
              <Typography sx={{ color: 'text.primary', fontSize: '1.1rem', letterSpacing: 1 }}>
                {state.entered || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
              </Typography>
            </Paper>
          </Stack>

          <Stack spacing={1} sx={{ width: '100%' }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
              Original
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: '12px 16px', borderRadius: 2, bgcolor: '#f0f7f4', textAlign: 'left', minHeight: 48 }}
            >
              <Typography sx={{ color: 'text.primary', fontSize: '1.1rem', letterSpacing: 1 }}>
                {state.originalChinese}
              </Typography>
            </Paper>
          </Stack>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            How did you do?
          </Typography>
          <Stack direction="row" spacing={3} justifyContent="center">
            <PictureButton style={{ width: 56, height: 56 }} clicked={onYesClicked} src={likePic} aria-label="I got it right" />
            <PictureButton style={{ width: 56, height: 56 }} clicked={onNoClicked} src={dislikePic} aria-label="I got it wrong" />
          </Stack>
        </Stack>
      </Box>
    );
  }

  // Input view
  return (
    <Box sx={outerSx}>
      <Typography
        variant="overline"
        sx={{ textAlign: 'center', color: 'text.secondary', letterSpacing: 2, display: 'block' }}
      >
        Write in Chinese
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
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          Translate into Chinese
        </Typography>
        <Typography
          sx={{ fontSize: '1.25rem', fontWeight: 400, lineHeight: 1.5, color: 'text.primary' }}
        >
          {state.englishPrompt}
        </Typography>
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
          <Typography sx={{ fontWeight: 400, fontSize: '1.1rem', letterSpacing: 1, lineHeight: 1, color: '#fff' }}>
            {currentWord?.[state.charSet]}
          </Typography>
        </Box>
      </Paper>

      {/* Answer input */}
      <Stack spacing={1.5} alignItems="center">
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
          Your answer
        </Typography>
        <Input
          id="answerInput"
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
            <PictureButton type="secondary" src={micPic} aria-label="Record speech" clicked={onListenPinyin} />
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export default withRouter(connector(SentenceWrite));
