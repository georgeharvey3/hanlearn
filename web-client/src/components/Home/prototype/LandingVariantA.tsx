// PROTOTYPE (#402) A, "Brush": today's chengyu is written stroke by stroke as
// the visitor scrolls through a pinned hero. Then its pinyin and meaning land,
// the seal stamps, and the call to action rises. Throwaway.
import React from 'react';
import Box from '@mui/material/Box';

import { getDailyChengyu, chengyus } from '../../../data/chengyus';
import { colors, fonts } from '../../../theme';
import {
  Ctas,
  FullBleed,
  LandingFooter,
  LandingGlobals,
  Seal,
  StrokeChar,
  easeOut,
  landingCopy,
  span,
  useGutter,
  useSectionProgress,
  useStrokeData,
} from './landingShared';

export const name = 'Brush';

const DRAW_END = 0.62;

const LandingVariantA: React.FC = () => {
  const { phone, topBar } = useGutter();
  const { ref, progress: p } = useSectionProgress(topBar);
  const daily = React.useMemo(() => getDailyChengyu(), []);
  const chars = daily.chengyu.split('');
  const meaning = chengyus.find((c) => c.characters === daily.chengyu)?.meaning ?? '';
  const data = useStrokeData(chars);

  // Each character gets a quarter of the drawing window, so a character with
  // many strokes draws faster: the pace of the scroll stays even per glyph.
  const charProgress = (i: number) =>
    span(p, (i * DRAW_END) / chars.length, ((i + 1) * DRAW_END) / chars.length);
  const size = phone ? 76 : 150;
  const meaningIn = easeOut(span(p, 0.64, 0.74));
  const sealIn = span(p, 0.74, 0.8);
  const ctaIn = easeOut(span(p, 0.8, 0.92));

  return (
    <>
      <LandingGlobals />
      <FullBleed cancelTop bg={colors.paper}>
        <Box ref={ref} sx={{ height: '360vh', position: 'relative' }}>
          <Box
            sx={{
              position: 'sticky',
              top: topBar,
              height: `calc(100svh - ${topBar}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 2.5, sm: 4 },
              px: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                fontSize: { xs: 13, sm: 14 },
                letterSpacing: 2,
                color: colors.textSecondary,
                textTransform: 'uppercase',
              }}
            >
              {landingCopy.todaysChengyu}
            </Box>

            <Box sx={{ position: 'relative', display: 'flex', gap: { xs: 1, sm: 2 } }}>
              {chars.map((c, i) => {
                const cp = charProgress(i);
                return (
                  <Box key={i} sx={{ textAlign: 'center' }}>
                    <StrokeChar
                      char={c}
                      data={data[i]}
                      progress={cp}
                      id={`brush-${i}`}
                      size={size}
                    />
                    <Box
                      sx={{
                        mt: 1,
                        fontSize: { xs: 15, sm: 20 },
                        color: colors.primaryDark,
                        opacity: span(cp, 0.85, 1),
                        transform: `translateY(${(1 - span(cp, 0.85, 1)) * 8}px)`,
                      }}
                    >
                      {daily.charPinyins[i]?.pinyin}
                    </Box>
                  </Box>
                );
              })}
              <Seal
                size={phone ? 34 : 56}
                sx={{
                  position: 'absolute',
                  right: phone ? -14 : -40,
                  bottom: phone ? 18 : 30,
                  opacity: sealIn,
                  transform: `scale(${1.6 - 0.6 * easeOut(sealIn)}) rotate(-4deg)`,
                }}
              />
            </Box>

            <Box
              sx={{
                fontSize: { xs: 18, sm: 24 },
                fontStyle: 'italic',
                color: colors.text,
                textAlign: 'center',
                maxWidth: 520,
                minHeight: '1.5em',
                opacity: meaningIn,
                transform: `translateY(${(1 - meaningIn) * 12}px)`,
              }}
            >
              {meaning}
            </Box>

            <Box
              sx={{
                textAlign: 'center',
                opacity: ctaIn,
                transform: `translateY(${(1 - ctaIn) * 24}px)`,
                pointerEvents: ctaIn > 0.5 ? 'auto' : 'none',
                maxWidth: 560,
              }}
            >
              <Box
                component="h1"
                sx={{
                  m: 0,
                  fontSize: { xs: 28, sm: 44 },
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: colors.text,
                }}
              >
                {landingCopy.brushHeadline}
              </Box>
              <Box
                sx={{ mt: 1.5, mb: 3, fontSize: { xs: 16, sm: 18 }, color: colors.textSecondary }}
              >
                {landingCopy.brushSub}
              </Box>
              <Ctas />
            </Box>

            {/* Scroll cue: a brush line that drips down and fades once drawing starts. */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                color: colors.textSecondary,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                opacity: 1 - span(p, 0, 0.05),
                '@keyframes drip': {
                  '0%': { transform: 'scaleY(0)', transformOrigin: 'top' },
                  '50%': { transform: 'scaleY(1)', transformOrigin: 'top' },
                  '51%': { transform: 'scaleY(1)', transformOrigin: 'bottom' },
                  '100%': { transform: 'scaleY(0)', transformOrigin: 'bottom' },
                },
              }}
            >
              {landingCopy.scroll}
              <Box
                sx={{
                  width: 2,
                  height: 36,
                  mx: 'auto',
                  mt: 1,
                  bgcolor: colors.text,
                  animation: 'drip 1.8s ease-in-out infinite',
                }}
              />
            </Box>
          </Box>
        </Box>
      </FullBleed>

      {/* Features: one big glyph per row, like entries in a copybook. */}
      <Box sx={{ maxWidth: 880, mx: 'auto', py: { xs: 6, sm: 10 } }}>
        {landingCopy.features.map((f, i) => (
          <Box
            key={f.glyph}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '72px 1fr', sm: '140px 1fr' },
              alignItems: 'center',
              gap: { xs: 2, sm: 4 },
              py: { xs: 3, sm: 4 },
              borderTop: i ? `1px solid ${colors.divider}` : 'none',
            }}
          >
            <Box
              sx={{
                fontFamily: fonts.hanzi,
                fontSize: { xs: 64, sm: 120 },
                lineHeight: 1,
                color: colors.text,
              }}
            >
              {f.glyph}
            </Box>
            <Box>
              <Box sx={{ fontSize: { xs: 20, sm: 26 }, fontWeight: 700, color: colors.text }}>
                {f.title}
              </Box>
              <Box sx={{ mt: 0.5, fontSize: { xs: 15, sm: 17 }, color: colors.textSecondary }}>
                {f.body}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      <FullBleed bg={colors.primaryDark}>
        <Box sx={{ py: { xs: 8, sm: 12 }, px: 2, textAlign: 'center', color: colors.white }}>
          <Box component="h2" sx={{ m: 0, mb: 3, fontSize: { xs: 26, sm: 38 }, fontWeight: 700 }}>
            {landingCopy.finalHeadline}
          </Box>
          <Ctas inverse />
        </Box>
      </FullBleed>
      <LandingFooter />
    </>
  );
};

export default LandingVariantA;
