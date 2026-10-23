// PROTOTYPE (#403) variant J, "Daily chengyu": after The Chairman's Bao and Du
// Chinese, the Dashboard is something new to read each day. The chengyu is
// never one of the learner's due words, so it cannot leak. The session is one
// line above it. Throwaway.
import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';

import { colors, fonts, shadows } from '../../../theme';
import { convertDailyChengyu, getDailyChengyu } from '../../../data/chengyus';
import {
  ChengyuSentence,
  getChengyuExampleSentence,
} from '../../../services/chengyuSentenceService';
import { DashboardVariantProps, SessionStrip } from './dashboardShared';

export const name = 'Daily chengyu';

const REVEALED_KEY = 'chengyuRevealedDate';
const todayIso = () => new Date().toISOString().slice(0, 10);

const VariantJ: React.FC<DashboardVariantProps> = (props) => {
  const { charSet } = props;
  const daily = useMemo(() => getDailyChengyu(), []);
  const { chengyu, charPinyins } = useMemo(
    () => convertDailyChengyu(daily, charSet),
    [daily, charSet],
  );
  const [revealed, setRevealed] = useState(() => {
    try {
      return localStorage.getItem(REVEALED_KEY) === todayIso();
    } catch {
      return false;
    }
  });
  const [wrong, setWrong] = useState<string[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [sentence, setSentence] = useState<ChengyuSentence | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const chars = Array.from(chengyu).filter((c) => c !== '，' && c !== ',');
  const syllables = daily.pinyin.split(' ');

  useEffect(() => {
    if (!revealed) return;
    getChengyuExampleSentence(daily.chengyu, charSet)
      .then((s) => setSentence(s))
      .catch(() => setSentence(null));
  }, [revealed, daily.chengyu, charSet]);

  const choose = (option: string) => {
    if (option === daily.correct) {
      setRevealed(true);
      try {
        localStorage.setItem(REVEALED_KEY, todayIso());
      } catch {
        // A private window: the quiz asks again next visit.
      }
    } else {
      setWrong((w) => [...w, option]);
    }
  };

  const today = new Date();

  return (
    <Box
      sx={{
        maxWidth: 560,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pb: 24,
        textAlign: 'left',
      }}
    >
      <SessionStrip {...props} />

      <Box
        sx={{ bgcolor: colors.card, boxShadow: shadows.card, borderRadius: 2, overflow: 'hidden' }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2.5, pt: 2 }}>
          <Typography sx={{ fontFamily: fonts.hanzi, color: colors.primaryLight, fontSize: 16 }}>
            今日成语
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {today.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
          </Typography>
        </Box>

        {/* The four characters; tap one for its pinyin and gloss. */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: { xs: 0.5, sm: 1.5 },
            pt: 3,
            pb: 1,
          }}
        >
          {chars.map((c, i) => (
            <ButtonBase
              key={i}
              onClick={() => setFocus(focus === i ? null : i)}
              sx={{
                flexDirection: 'column',
                px: 0.75,
                py: 0.5,
                borderRadius: 1,
                bgcolor: focus === i ? colors.errorSurface : 'transparent',
              }}
            >
              <Typography sx={{ fontSize: 13, color: colors.textSecondary, minHeight: 20 }}>
                {syllables[i]}
              </Typography>
              <Typography
                sx={{ fontFamily: fonts.hanzi, fontSize: { xs: 64, sm: 80 }, lineHeight: 1.1 }}
              >
                {c}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
        <Box sx={{ minHeight: 28, textAlign: 'center', px: 2 }}>
          {focus !== null && (
            <Typography color="text.secondary">
              {chars[focus]} · {charPinyins[focus]?.meaning ?? '—'}
            </Typography>
          )}
        </Box>

        <Box sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
          {!revealed ? (
            <>
              <Typography sx={{ fontWeight: 600, mb: 1.25 }}>What does it mean?</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {daily.options.map((o) => {
                  const isWrong = wrong.includes(o);
                  return (
                    <Button
                      key={o}
                      onClick={() => choose(o)}
                      disabled={isWrong}
                      variant="outlined"
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 1.25,
                        color: colors.text,
                        borderColor: colors.borderStrong,
                        '&.Mui-disabled': {
                          color: colors.primaryLight,
                          borderColor: colors.primaryLight,
                          bgcolor: colors.errorSurface,
                          textDecoration: 'line-through',
                        },
                      }}
                    >
                      {o}
                    </Button>
                  );
                })}
              </Box>
            </>
          ) : (
            <>
              <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{daily.correct}</Typography>

              {/* Character by character. */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mt: 2 }}>
                {charPinyins.map((c, i) => (
                  <Box
                    key={i}
                    sx={{ textAlign: 'center', p: 1, bgcolor: colors.paper, borderRadius: 1 }}
                  >
                    <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 26 }}>{c.char}</Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', color: colors.textSecondary }}
                    >
                      {c.pinyin}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block' }}>
                      {c.meaning ?? '—'}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* In a sentence. */}
              <Box sx={{ mt: 2.5, pl: 1.5, borderLeft: `3px solid ${colors.primaryLight}` }}>
                {sentence === undefined && (
                  <>
                    <Skeleton width="90%" />
                    <Skeleton width="60%" />
                  </>
                )}
                {sentence && (
                  <>
                    <Typography sx={{ fontFamily: fonts.hanzi, fontSize: 20 }}>
                      {sentence.chinese}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {sentence.pinyin}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {sentence.english}
                    </Typography>
                  </>
                )}
                {sentence === null && (
                  <Typography variant="body2" color="text.secondary">
                    No example sentence
                  </Typography>
                )}
              </Box>

              <Button
                onClick={() => setSaved(true)}
                disabled={saved}
                sx={{ mt: 2, color: colors.primaryDark, px: 0 }}
              >
                {saved ? 'Added to your words' : 'Add to my words'}
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default VariantJ;
