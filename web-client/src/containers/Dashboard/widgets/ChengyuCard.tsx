import React, { useEffect, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { RootState } from '../../../types/store';
import { Word } from '../../../types/models';
import { postWord } from '../../../store/actions/word';
import { convertDailyChengyu, getDailyChengyu } from '../../../data/chengyus';
import {
  ChengyuSentence,
  getChengyuExampleSentence,
} from '../../../services/chengyuSentenceService';
import { reportError } from '../../../services/errorReporting';
import { dayKey } from '../../../utils/retention';
import { Card } from './parts';

const text = copy.dashboard.chengyu;

/** Today's answer, so a return visit shows the result rather than asking again. */
const ANSWER_KEY = 'chengyuAnswer';

// The local day, as the rest of the Dashboard keys a day.
const todayIso = () => dayKey(new Date());

function readAnswer(): { correct: boolean } | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ANSWER_KEY) ?? 'null');
    return stored?.date === todayIso() ? { correct: stored.correct === true } : null;
  } catch {
    return null;
  }
}

function saveAnswer(correct: boolean): void {
  try {
    localStorage.setItem(ANSWER_KEY, JSON.stringify({ date: todayIso(), correct }));
  } catch {
    // A private window: the quiz asks again on the next visit.
  }
}

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  words: state.addWords.words,
});

const connector = connect(mapStateToProps, { onSaveWord: postWord });

type Props = ConnectedProps<typeof connector> & { loading: boolean };

/**
 * The chengyu of the day, as a one-question quiz. The chengyu is never one of
 * the learner's due words, so it is the one thing on the Dashboard that shows
 * characters.
 */
const ChengyuCard: React.FC<Props> = ({ loading, userId, words, onSaveWord }) => {
  const charSet: 'simp' | 'trad' = localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad';
  const daily = useMemo(() => getDailyChengyu(), []);
  const { charPinyins } = useMemo(() => convertDailyChengyu(daily, charSet), [daily, charSet]);
  const [answer, setAnswer] = useState(readAnswer);
  const [sentence, setSentence] = useState<ChengyuSentence | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  // The pinyin gives away part of the answer, so it waits for a tap or the answer.
  const [pinyinAsked, setPinyinAsked] = useState(false);
  const pinyinShown = pinyinAsked || answer !== null;
  const alreadySaved = words.some((w) => w.simp === daily.chengyu);

  useEffect(() => {
    if (!answer) return;
    getChengyuExampleSentence(daily.chengyu, charSet)
      .then(setSentence)
      .catch((error) => {
        reportError(error, {
          feature: 'chengyu-example-sentence',
          context: { chengyu: daily.chengyu },
        });
        setSentence(null);
      });
  }, [answer, daily.chengyu, charSet]);

  const choose = (option: string) => {
    const correct = option === daily.correct;
    saveAnswer(correct);
    setAnswer({ correct });
  };

  const save = () => {
    if (!userId || alreadySaved || saved) return;
    const word: Word = {
      id: Date.now(),
      simp: daily.chengyu,
      trad: daily.tradChengyu,
      pinyin: daily.pinyin,
      meaning: daily.correct,
    };
    onSaveWord(word);
    setSaved(true);
  };

  return (
    <Card sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography
          lang="zh"
          sx={{
            fontFamily: fonts.hanzi,
            fontSize: 16,
            letterSpacing: '0.1em',
            color: colors.primaryLight,
          }}
        >
          {text.label}
        </Typography>
        <Typography sx={{ fontSize: 14, color: colors.textSecondary }}>
          {copy.dashboard.longDate(dayKey(new Date()))}
        </Typography>
      </Box>

      {loading ? (
        <Box aria-hidden sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[72, 20, 44, 44].map((h, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={h}
              width={i === 1 ? '50%' : '100%'}
              sx={{ bgcolor: colors.skeleton }}
            />
          ))}
        </Box>
      ) : (
        <>
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              textAlign: 'center',
            }}
          >
            {charPinyins.map((c, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
              >
                {/* A hidden row keeps its height, so the characters do not move on reveal. */}
                <Typography
                  lang="zh-Latn"
                  aria-hidden={!pinyinShown}
                  sx={{ fontSize: 13, color: colors.textSecondary }}
                >
                  {pinyinShown ? c.pinyin : '\u00a0'}
                </Typography>
                <Typography
                  lang="zh"
                  sx={{ fontFamily: fonts.hanzi, fontSize: { xs: 56, md: 64 }, lineHeight: 1.1 }}
                >
                  {c.char}
                </Typography>
                {answer && c.meaning && (
                  <Typography sx={{ fontSize: 12, color: colors.textSecondary }}>
                    {c.meaning}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          {!pinyinShown && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
              <Button
                onClick={() => setPinyinAsked(true)}
                sx={{
                  minHeight: 44,
                  px: 2,
                  textTransform: 'none',
                  fontSize: 14,
                  color: colors.textSecondary,
                }}
              >
                {text.showPinyin}
              </Button>
            </Box>
          )}

          {!answer ? (
            <>
              <Typography component="h3" sx={{ m: '24px 0 8px', fontSize: 17, fontWeight: 600 }}>
                {text.question}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {daily.options.map((option) => (
                  <Button
                    key={option}
                    onClick={() => choose(option)}
                    sx={{
                      minHeight: 44,
                      px: 1.75,
                      py: 1,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                      fontSize: 15,
                      color: colors.text,
                      border: `1px solid ${colors.borderStrong}`,
                      borderRadius: 1,
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </>
          ) : (
            <Box
              aria-live="polite"
              sx={{
                mt: 2.5,
                pt: 2,
                borderTop: `1px solid ${colors.divider}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                    color: answer.correct ? colors.success : colors.primaryLight,
                  }}
                >
                  {answer.correct ? text.correct : text.itMeans}
                </Typography>
                <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{daily.correct}</Typography>
              </Box>
              {sentence === undefined && (
                <Box aria-hidden>
                  <Skeleton width="90%" />
                  <Skeleton width="60%" />
                </Box>
              )}
              {sentence && (
                <>
                  <Typography
                    lang="zh"
                    sx={{ fontFamily: fonts.hanzi, fontSize: 22, lineHeight: 1.4 }}
                  >
                    {sentence.chinese}
                  </Typography>
                  <Typography sx={{ fontSize: 14, color: colors.textSecondary }}>
                    {sentence.english}
                  </Typography>
                </>
              )}
              {sentence === null && (
                <Typography sx={{ fontSize: 14, color: colors.textSecondary }}>
                  {text.noSentence}
                </Typography>
              )}
              {userId && (
                <Box>
                  <Button
                    onClick={save}
                    disabled={alreadySaved || saved}
                    sx={{
                      height: 44,
                      px: 2,
                      textTransform: 'none',
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.text,
                      border: `1px solid ${colors.borderStrong}`,
                      borderRadius: 1,
                    }}
                  >
                    {alreadySaved || saved ? text.added : text.addToWords}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Card>
  );
};

export default connector(ChengyuCard);
