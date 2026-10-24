import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import SearchRounded from '@mui/icons-material/SearchRounded';

import { copy } from '../../../copy';
import { colors, fonts } from '../../../theme';
import { featureDemos as demo } from './demoData';
import { CELADON } from './layout';
import {
  clamp01,
  easeInOut,
  easeOut,
  span,
  useGutter,
  useSectionProgress,
  useStageScale,
} from './motion';
import { StrokeChar, useStrokeData } from './StrokeChar';

// The four features as tabs on a pinned stage. The scroll drives it all: each
// feature takes an equal share, in which its character is traced, its words
// come in, and its demo appears and plays through, before the next tab.

const features = copy.landing.features;
const glyphs = features.map((f) => f.glyph);

const Title: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box
    component="h3"
    sx={{ m: 0, fontSize: { xs: 20, sm: 24 }, fontWeight: 700, color: colors.text, ...sx }}
  >
    {children}
  </Box>
);

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{ mt: 0.5, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.45, color: colors.textSecondary }}
  >
    {children}
  </Box>
);

const SearchDemo: React.FC<{ t: number }> = ({ t }) => {
  const typed = demo.query.slice(0, Math.floor(span(t, 300, 1500) * demo.query.length));
  const hit = span(t, 1700, 2100);
  return (
    <Box sx={{ width: '100%', maxWidth: 260 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 40,
          px: 1.5,
          bgcolor: colors.card,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 1,
          fontSize: 15,
          color: colors.text,
        }}
      >
        <SearchRounded sx={{ fontSize: 20, color: colors.textSecondary }} />
        {typed}
        <Box
          component="span"
          sx={{
            width: '1px',
            height: 18,
            bgcolor: colors.text,
          }}
        />
      </Box>
      <Box
        sx={{
          mt: 1,
          display: 'flex',
          alignItems: 'baseline',
          gap: 1.25,
          px: 1.5,
          py: 1,
          bgcolor: colors.card,
          borderRadius: 1,
          boxShadow: '0 8px 20px -14px rgba(26, 92, 64, 0.5)',
        }}
        style={{ opacity: hit, transform: `translateY(${(1 - hit) * 6}px)` }}
      >
        <Box sx={{ fontFamily: fonts.hanzi, fontSize: 24, color: colors.text }}>
          {demo.result.char}
        </Box>
        <Box sx={{ fontSize: 14, color: colors.primaryDark }}>{demo.result.pinyin}</Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' }}>
          {demo.result.meaning}
        </Box>
      </Box>
    </Box>
  );
};

/** A character splits into its parts, each with its sound and meaning. */
const BreakdownDemo: React.FC<{ t: number }> = ({ t }) => {
  const { char, meaning, parts } = demo.breakdown;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ fontFamily: fonts.hanzi, fontSize: { xs: 52, md: 84 }, color: colors.text }}>
          {char}
        </Box>
        <Box
          sx={{ fontSize: { xs: 13, md: 15 }, fontStyle: 'italic', color: colors.textSecondary }}
        >
          {meaning}
        </Box>
      </Box>
      {parts.map((part, i) => {
        const show = easeOut(span(t, 300 + i * 600, 800 + i * 600));
        return (
          <React.Fragment key={part.char}>
            <Box sx={{ fontSize: 20, color: colors.textSecondary }} style={{ opacity: show }}>
              {i === 0 ? '=' : '+'}
            </Box>
            <Box
              sx={{
                px: 1.25,
                py: 0.75,
                textAlign: 'center',
                bgcolor: colors.card,
                borderRadius: 1,
                boxShadow: '0 8px 20px -14px rgba(26, 92, 64, 0.5)',
              }}
              style={{ opacity: show, transform: `translateX(${(1 - show) * -12}px)` }}
            >
              <Box
                sx={{ fontFamily: fonts.hanzi, fontSize: { xs: 30, md: 48 }, color: colors.text }}
              >
                {part.char}
              </Box>
              <Box sx={{ fontSize: { xs: 12, md: 14 }, color: colors.primaryDark }}>
                {part.pinyin}
              </Box>
              <Box
                sx={{
                  fontSize: { xs: 12, md: 14 },
                  fontStyle: 'italic',
                  color: colors.textSecondary,
                }}
              >
                {part.meaning}
              </Box>
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

/** The day's idiom: one wrong guess, then the right one. */
const ChengyuDemo: React.FC<{ t: number }> = ({ t }) => {
  const { chars, pinyin, options, correct, miss } = demo.chengyu;
  const missed = t >= 800;
  const solved = t >= 1600;
  return (
    <Box sx={{ width: '100%', maxWidth: { xs: 260, md: 320 }, textAlign: 'center' }}>
      <Box
        sx={{
          fontFamily: fonts.hanzi,
          fontSize: { xs: 24, md: 40 },
          lineHeight: 1.2,
          color: colors.text,
        }}
      >
        {chars}
      </Box>
      <Box sx={{ fontSize: { xs: 13, md: 15 }, color: colors.primaryDark }}>{pinyin}</Box>
      <Box sx={{ mt: { xs: 0.75, md: 1.5 }, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {options.map((op, i) => {
          const wrong = i === miss && missed;
          const right = i === correct && solved;
          return (
            <Box
              key={op}
              sx={{
                py: { xs: '3px', md: 0.75 },
                fontSize: { xs: 13, md: 15 },
                borderRadius: 1,
                border: `1px solid ${right ? colors.success : wrong ? colors.error : colors.borderStrong}`,
                bgcolor: right ? colors.success : colors.card,
                color: right ? colors.white : wrong ? colors.error : colors.text,
                textDecoration: wrong ? 'line-through' : undefined,
                transition: 'all 200ms',
              }}
            >
              {op}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const SentenceDemo: React.FC<{ t: number }> = ({ t }) => {
  const mark = span(t, 600, 1100);
  const gloss = span(t, 1400, 1900);
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ fontFamily: fonts.hanzi, fontSize: 30, color: colors.text, lineHeight: 1.4 }}>
        {demo.sentence.map((w, i) => (
          <Box
            component="span"
            key={i}
            sx={{
              position: 'relative',
              color: i === demo.sentenceWord && mark > 0 ? colors.primaryDark : undefined,
            }}
          >
            {w}
            {i === demo.sentenceWord && (
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 2,
                  bgcolor: colors.primaryDark,
                  transformOrigin: 'left',
                }}
                style={{ transform: `scaleX(${mark})` }}
              />
            )}
          </Box>
        ))}
      </Box>
      <Box
        sx={{ mt: 0.5, fontSize: 14, fontStyle: 'italic', color: colors.textSecondary }}
        style={{ opacity: gloss }}
      >
        {demo.sentenceGloss}
      </Box>
    </Box>
  );
};

// Within each feature's share of the scroll: its character is traced, then
// its words come in, then its demo appears and the scroll plays it through,
// then the next tab.
const TRACE = [0.02, 0.32] as const;
const WORDS_IN = 0.28;
const DEMO_IN = 0.4;
// The scroll plays the demo through from here to here, then holds its end.
const PLAY = [0.45, 0.88] as const;
// How long each demo runs, in its own milliseconds: search, breakdown,
// sentences, chengyu.
const DEMO_MS = [2200, 2000, 2000, 2400];

const Features: React.FC = () => {
  const { phone, topBar } = useGutter();
  const scale = useStageScale();
  const { ref, progress: p } = useSectionProgress(topBar);
  const data = useStrokeData(glyphs);
  const n = features.length;
  const tab = Math.min(n - 1, Math.floor(p * n));
  const local = clamp01(p * n - tab);
  // The scroll, not a clock, plays the demo.
  const t = span(local, PLAY[0], PLAY[1]) * DEMO_MS[tab];
  const f = features[tab];

  // A tap on a tab scrolls to where that feature's demo is showing.
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - topBar;
    const distance = el.offsetHeight - (window.innerHeight - topBar);
    window.scrollTo({ top: top + ((i + DEMO_IN + 0.05) / n) * distance, behavior: 'smooth' });
  };

  const demos = [
    <SearchDemo key="s" t={t} />,
    <BreakdownDemo key="b" t={t} />,
    <SentenceDemo key="x" t={t} />,
    <ChengyuDemo key="c" t={t} />,
  ];
  const wordsIn = easeOut(span(local, WORDS_IN, WORDS_IN + 0.1));
  const demoIn = easeOut(span(local, DEMO_IN, DEMO_IN + 0.08));

  return (
    <Box ref={ref} sx={{ height: `${n * 95 + 40}vh`, position: 'relative', bgcolor: colors.paper }}>
      <Box
        sx={{
          position: 'sticky',
          top: topBar,
          height: `calc(100svh - ${topBar}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          textAlign: 'left',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 940 }} style={{ zoom: scale }}>
          <Box
            role="tablist"
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${n}, 1fr)`,
              gap: { xs: 1, sm: 2 },
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            {features.map((g, i) => (
              <ButtonBase
                key={g.glyph}
                role="tab"
                aria-selected={i === tab}
                onClick={() => goTo(i)}
                sx={{
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 1,
                  borderRadius: 1,
                  color: i === tab ? colors.primaryDark : colors.textSecondary,
                  transition: 'color 200ms',
                }}
              >
                <Box
                  sx={{ fontFamily: fonts.hanzi, fontSize: { xs: 28, sm: 36 }, lineHeight: 1.1 }}
                >
                  {g.glyph}
                </Box>
                <Box
                  sx={{
                    width: '100%',
                    height: 2,
                    bgcolor: colors.divider,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{ position: 'absolute', inset: 0, bgcolor: colors.primaryDark }}
                    style={{
                      transformOrigin: 'left',
                      transform: `scaleX(${i < tab ? 1 : i > tab ? 0 : local})`,
                    }}
                  />
                </Box>
              </ButtonBase>
            ))}
          </Box>

          <Box
            key={tab}
            sx={{
              mt: { xs: 3, md: 6 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' },
              alignItems: 'center',
              justifyItems: { xs: 'center', md: 'stretch' },
              columnGap: 7,
              rowGap: { xs: 2.5, md: 0 },
              '@keyframes tabIn': {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
              animation: 'tabIn 300ms ease-out',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5 }}>
              <StrokeChar
                char={f.glyph}
                data={data[tab]}
                id={`scroll-${tab}`}
                size={phone ? 130 : 220}
                progress={easeInOut(span(local, TRACE[0], TRACE[1]))}
              />
              <Box
                sx={{
                  width: { xs: 'min(100%, 340px)', md: 260 },
                  textAlign: 'center',
                }}
                style={{ opacity: wordsIn, transform: `translateY(${(1 - wordsIn) * 10}px)` }}
              >
                <Title sx={{ fontSize: { xs: 22, sm: 26 } }}>{f.title}</Title>
                <Body>{f.body}</Body>
              </Box>
            </Box>
            <Box
              sx={{
                width: { xs: 'min(100%, 340px)', md: '100%' },
                height: { xs: 170, md: 320 },
                bgcolor: CELADON,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
                boxSizing: 'border-box',
              }}
              style={{ opacity: demoIn, transform: `translateY(${(1 - demoIn) * 16}px)` }}
            >
              {demos[tab]}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Features;
