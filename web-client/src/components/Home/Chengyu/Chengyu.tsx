import React, { useEffect, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

import { getDailyChengyu, convertDailyChengyu } from '../../../data/chengyus';
import { lookupCharacterMeanings } from '../../../services/chengyuService';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { postWord } from '../../../store/actions/word';
import {
  getChengyuExampleSentence,
  ChengyuSentence,
} from '../../../services/chengyuSentenceService';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  words: state.addWords.words,
});

const mapDispatchToProps = {
  onSaveWord: postWord,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const Chengyu: React.FC<PropsFromRedux> = ({ userId, words, onSaveWord }) => {
  const [finished, setFinished] = useState(false);
  const [incorrect, setIncorrect] = useState<number[]>([]);
  const [charMeanings, setCharMeanings] = useState<Map<string, string>>(new Map());
  const [saved, setSaved] = useState(false);
  const [exampleSentence, setExampleSentence] = useState<ChengyuSentence | null>(null);
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [charSet] = useState<'simp' | 'trad'>(
    (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp',
  );

  const dailyChengyu = useMemo(() => getDailyChengyu(), []);

  // Select the correct character set synchronously — no async conversion needed
  const { chengyu: displayChengyu, charPinyins } = useMemo(
    () => convertDailyChengyu(dailyChengyu, charSet),
    [dailyChengyu, charSet],
  );

  useEffect(() => {
    if (finished) {
      // Look up character meanings when the chengyu is revealed
      const chars = charPinyins.map((c) => c.char);
      lookupCharacterMeanings(chars, charSet).then((results) => {
        const meanings = new Map<string, string>();
        results.forEach((result) => {
          meanings.set(result.char, result.meaning);
        });
        setCharMeanings(meanings);
      });

      // Fetch example sentence
      setSentenceLoading(true);
      getChengyuExampleSentence(dailyChengyu.chengyu, charSet)
        .then((sentence) => setExampleSentence(sentence))
        .catch(() => setExampleSentence(null))
        .finally(() => setSentenceLoading(false));
    }
  }, [finished, charPinyins, charSet, dailyChengyu.chengyu]);

  const optionClicked = (_event: React.MouseEvent, index: number): void => {
    if (dailyChengyu.options[index] !== dailyChengyu.correct) {
      setIncorrect((prev) => prev.concat(index));
    } else {
      setFinished(true);
    }
  };

  const alreadySaved = useMemo(() => {
    const simpChars = dailyChengyu.chengyu;
    return words.some((w) => w.simp === simpChars || w.trad === simpChars);
  }, [words, dailyChengyu.chengyu]);

  const handleSave = () => {
    if (!userId || alreadySaved || saved) return;
    const word: Word = {
      id: Date.now(),
      simp: dailyChengyu.chengyu,
      trad: dailyChengyu.tradChengyu,
      pinyin: dailyChengyu.pinyin,
      meaning: dailyChengyu.correct,
    };
    onSaveWord(word);
    setSaved(true);
  };

  let details: React.ReactNode = null;

  if (finished) {
    details = (
      <List sx={{ m: 0, p: 0 }} aria-label="Character breakdown">
        {charPinyins.map((c, index) => {
          const meaning = charMeanings.get(c.char) || '';
          return (
            <React.Fragment key={index}>
              <Box
                component="li"
                sx={{
                  listStyle: 'none',
                  backgroundColor: 'transparent',
                  color: 'text.primary',
                  mb: 1,
                }}
              >
                <Typography
                  lang="zh"
                  sx={{ fontSize: '1.5em', m: '3px auto', fontWeight: 'normal' }}
                >
                  {c.char}
                </Typography>
                <Typography lang="zh-Latn" sx={{ fontSize: '0.9em', mb: '5px' }}>
                  ({c.pinyin})
                </Typography>
                {meaning && (
                  <Typography sx={{ fontSize: '0.85em', fontStyle: 'italic', opacity: 0.8 }}>
                    {meaning}
                  </Typography>
                )}
              </Box>
            </React.Fragment>
          );
        })}
        <Box
          component="li"
          sx={{
            listStyle: 'none',
            backgroundColor: 'transparent',
            color: 'text.primary',
            fontStyle: 'italic',
          }}
        >
          {dailyChengyu.correct}
        </Box>
        {sentenceLoading && (
          <Box component="li" sx={{ listStyle: 'none', mt: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        {exampleSentence && (
          <Box
            component="li"
            aria-label="Example sentence"
            sx={{
              listStyle: 'none',
              backgroundColor: 'action.hover',
              borderRadius: '8px',
              p: 2,
              mt: 2,
            }}
          >
            <Typography sx={{ fontSize: '0.75em', fontWeight: 'bold', mb: 0.5, opacity: 0.6 }}>
              Example
            </Typography>
            <Typography lang="zh" sx={{ fontSize: '1.2em', mb: 0.5 }}>
              {exampleSentence.chinese}
            </Typography>
            <Typography lang="zh-Latn" sx={{ fontSize: '0.85em', mb: 0.5, opacity: 0.8 }}>
              {exampleSentence.pinyin}
            </Typography>
            <Typography sx={{ fontSize: '0.85em', fontStyle: 'italic', opacity: 0.8 }}>
              {exampleSentence.english}
            </Typography>
          </Box>
        )}
      </List>
    );
  }

  const saveButton =
    finished && userId ? (
      <Button
        variant="contained"
        color="primary"
        onClick={handleSave}
        disabled={alreadySaved || saved}
        sx={{ mt: 2 }}
      >
        {saved ? 'Saved!' : alreadySaved ? 'Already saved' : 'Save to my words'}
      </Button>
    ) : null;

  return (
    <Paper
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        color: 'text.primary',
        textAlign: 'center',
        fontSize: { xs: '1.1em', sm: '1.4em' },
      }}
    >
      <Typography variant="h5" sx={{ m: '5px 0' }}>
        Chengyu Of The Day
      </Typography>
      <Typography variant="h4" fontWeight="bold" lang="zh">
        {displayChengyu}
      </Typography>
      <Typography variant="body1" sx={{ m: '5px 0', fontSize: { xs: '1.1em', sm: '1.3em' } }}>
        Choose the correct translation:
      </Typography>
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
      >
        {finished
          ? `Correct! The answer is: ${dailyChengyu.correct}`
          : incorrect.length > 0
            ? 'Incorrect. Try again.'
            : ''}
      </Box>
      <List
        component="div"
        role="group"
        sx={{ p: 0, width: '100%', maxWidth: 600 }}
        aria-label="Answer options"
      >
        {dailyChengyu.options.map((op, index) => {
          const isCorrect = op === dailyChengyu.correct;
          const isIncorrect = incorrect.includes(index);
          const isHidden = finished && !isCorrect;

          const ariaLabel = isIncorrect
            ? `${op} — incorrect`
            : finished && isCorrect
              ? `${op} — correct`
              : op;

          return (
            <ListItemButton
              key={index}
              onClick={(event) => optionClicked(event, index)}
              aria-label={ariaLabel}
              aria-disabled={isHidden || undefined}
              sx={{
                listStyle: 'none',
                borderRadius: '5px',
                color: 'text.primary',
                opacity: isHidden ? 0 : 1,
                maxHeight: isHidden ? 0 : '50px',
                m: isHidden ? 0 : '5px',
                p: isHidden ? 0 : '15px',
                overflow: 'hidden',
                transition:
                  'opacity 0.25s ease-out, max-height 0.5s ease-out, margin 0.5s ease-out, padding 0.5s ease-out',
                justifyContent: 'center',
                backgroundColor: isIncorrect
                  ? 'error.main'
                  : finished && isCorrect
                    ? 'success.main'
                    : 'grey.400',
                '&:hover': {
                  backgroundColor: isIncorrect
                    ? 'error.main'
                    : finished && isCorrect
                      ? 'success.main'
                      : 'grey.500',
                  cursor: isHidden ? 'default' : 'pointer',
                },
              }}
              disabled={isHidden}
            >
              <ListItemText primary={op} sx={{ textAlign: 'center' }} />
            </ListItemButton>
          );
        })}
      </List>
      {details}
      {saveButton}
    </Paper>
  );
};

export default connector(Chengyu);
