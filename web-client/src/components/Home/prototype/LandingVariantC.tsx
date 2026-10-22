// PROTOTYPE (#402) C, "Wordmark": the old shrinking title, done as one
// continuous move. The wordmark fills the first screen and glides, with the
// scroll, into its place in the top bar, where it stays. Below, three rows of
// words drift sideways at different speeds as the page scrolls, and the steps
// fade up as they enter. No pinning: the scroll is never captured. Throwaway.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';

import { colors, fonts } from '../../../theme';
import {
  Ctas,
  FullBleed,
  LandingFooter,
  LandingGlobals,
  easeInOut,
  landingCopy,
  prefersReducedMotion,
  span,
  useGutter,
  useScrollY,
} from './landingShared';

export const name = 'Wordmark';

const TOOLBAR_BRAND = 'header a[href="/"]';

const rows: [string, string][][] = [
  [
    ['你好', 'hello'],
    ['学习', 'to study'],
    ['朋友', 'friend'],
    ['电脑', 'computer'],
    ['喜欢', 'to like'],
    ['天气', 'weather'],
    ['音乐', 'music'],
    ['时间', 'time'],
    ['城市', 'city'],
    ['问题', 'question'],
  ],
  [
    ['画蛇添足', 'to ruin by adding more'],
    ['一举两得', 'two birds, one stone'],
    ['马马虎虎', 'so-so'],
    ['半途而废', 'to give up halfway'],
    ['入乡随俗', 'when in Rome'],
  ],
  [
    ['熊猫', 'panda'],
    ['地铁', 'subway'],
    ['咖啡', 'coffee'],
    ['周末', 'weekend'],
    ['旅行', 'to travel'],
    ['医生', 'doctor'],
    ['图书馆', 'library'],
    ['月亮', 'moon'],
    ['回家', 'to go home'],
    ['明天', 'tomorrow'],
  ],
];

const steps = [
  {
    numeral: '一',
    title: 'Add the words you meet',
    body: 'Search the dictionary in hanzi, pinyin or English, or start from a ready-made list.',
  },
  {
    numeral: '二',
    title: 'Learn each one five ways',
    body: 'Read it, hear it, say it, and write it by hand. Each way keeps its own schedule.',
  },
  {
    numeral: '三',
    title: 'Come back when they’re due',
    body: 'A few minutes a day. The gaps grow from days to months as a word sticks.',
  },
];

/** Fades a block up once it scrolls into view. */
const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(prefersReducedMotion());
  useEffect(() => {
    if (seen || !ref.current) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setSeen(true);
      },
      { threshold: 0.25 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return (
    <Box
      ref={ref}
      sx={{
        opacity: seen ? 1 : 0,
        transform: seen ? 'none' : 'translateY(28px)',
        transition: `opacity 700ms ${delay}ms ease-out, transform 700ms ${delay}ms ease-out`,
      }}
    >
      {children}
    </Box>
  );
};

interface Box2 {
  left: number;
  top: number;
  width: number;
  height: number;
  font: number;
}

const LandingVariantC: React.FC = () => {
  const { topBar } = useGutter();
  const y = useScrollY();
  const measureRef = useRef<HTMLSpanElement>(null);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const [end, setEnd] = useState<Box2 | null>(null);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);

  // The landing spot is the top bar's own brand, which this variant hides.
  useLayoutEffect(() => {
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
      const brand = document.querySelector<HTMLElement>(TOOLBAR_BRAND);
      if (!brand) return;
      const r = brand.getBoundingClientRect();
      const font = parseFloat(getComputedStyle(brand).fontSize);
      setEnd({ left: r.left, top: r.top, width: r.width, height: r.height, font });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const travel = vh * 0.55;
  const q = prefersReducedMotion() ? 1 : easeInOut(span(y, 0, travel));

  let mark: React.CSSProperties = { opacity: 0 };
  if (end) {
    const startWidth = Math.min(vw * 0.86, 1100);
    const scale = startWidth / end.width;
    const startFont = end.font * scale;
    const startLeft = (vw - startWidth) / 2;
    const startTop = vh * 0.34 - (end.height * scale) / 2;
    const lerp = (a: number, b: number) => a + (b - a) * q;
    mark = {
      position: 'fixed',
      left: lerp(startLeft, end.left),
      top: lerp(startTop, end.top),
      fontSize: lerp(startFont, end.font),
      lineHeight: 1,
      zIndex: 1101,
      pointerEvents: 'none',
    };
  }

  const heroOut = span(y, 0, travel * 0.6);
  const ribbonTop = ribbonRef.current ? ribbonRef.current.offsetTop : 0;
  const drift = y - ribbonTop + vh;

  return (
    <>
      <LandingGlobals extra={{ [TOOLBAR_BRAND]: { visibility: 'hidden' } }} />
      <Box
        component="span"
        ref={measureRef}
        aria-hidden
        sx={{ fontFamily: fonts.brand, color: colors.text, whiteSpace: 'nowrap' }}
        style={mark}
      >
        HanLearn
      </Box>

      <FullBleed cancelTop bg={colors.paper} sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            height: `calc(100svh - ${topBar}px)`,
            minHeight: 480,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            pb: { xs: 8, sm: 10 },
          }}
        >
          {/* 汉学, faint and huge, behind the wordmark. It sinks slower than the page. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: '6%',
              left: '50%',
              fontFamily: fonts.hanzi,
              fontSize: { xs: '70vw', sm: '42vw' },
              lineHeight: 1,
              color: colors.outline,
              whiteSpace: 'nowrap',
              opacity: 0.55,
              userSelect: 'none',
            }}
            style={{ transform: `translate(-50%, ${y * 0.35}px)` }}
          >
            汉学
          </Box>
          <Box
            sx={{ position: 'relative', textAlign: 'center', px: 2 }}
            style={{ opacity: 1 - heroOut, transform: `translateY(${-heroOut * 30}px)` }}
          >
            <Box
              component="h1"
              sx={{
                m: 0,
                mb: 3,
                fontSize: { xs: 24, sm: 34 },
                fontWeight: 600,
                color: colors.text,
              }}
            >
              {landingCopy.wordmarkTagline}
            </Box>
            <Ctas />
          </Box>
        </Box>
      </FullBleed>

      {/* Ribbons of words that drift with the scroll, alternating direction. */}
      <FullBleed sx={{ overflow: 'hidden', py: { xs: 4, sm: 8 } }}>
        <Box ref={ribbonRef}>
          {rows.map((row, r) => {
            const dir = r % 2 ? 1 : -1;
            const speed = [0.25, 0.4, 0.3][r];
            const doubled = [...row, ...row, ...row];
            return (
              <Box
                key={r}
                sx={{
                  display: 'flex',
                  gap: { xs: 4, sm: 7 },
                  py: { xs: 1.5, sm: 2.5 },
                  whiteSpace: 'nowrap',
                  width: 'max-content',
                }}
                style={{
                  transform: `translateX(${dir * drift * speed - (dir > 0 ? 900 : 200)}px)`,
                }}
              >
                {doubled.map(([hz, en], i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
                    <Box
                      sx={{
                        fontFamily: fonts.hanzi,
                        fontSize: r === 1 ? { xs: 44, sm: 76 } : { xs: 32, sm: 52 },
                        color: r === 1 ? colors.primaryDark : colors.text,
                      }}
                    >
                      {hz}
                    </Box>
                    <Box
                      sx={{
                        fontSize: { xs: 13, sm: 15 },
                        color: colors.textSecondary,
                        fontStyle: 'italic',
                      }}
                    >
                      {en}
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </FullBleed>

      <Box sx={{ maxWidth: 760, mx: 'auto', py: { xs: 4, sm: 8 } }}>
        {steps.map((s, i) => (
          <Reveal key={s.numeral} delay={i * 60}>
            <Box
              sx={{
                display: 'flex',
                gap: { xs: 2.5, sm: 5 },
                alignItems: 'flex-start',
                py: { xs: 3, sm: 5 },
              }}
            >
              <Box
                sx={{
                  fontFamily: fonts.hanzi,
                  fontSize: { xs: 56, sm: 96 },
                  lineHeight: 0.9,
                  color: colors.primaryLight,
                  width: { xs: 56, sm: 96 },
                  textAlign: 'center',
                  flexShrink: 0,
                }}
              >
                {s.numeral}
              </Box>
              <Box>
                <Box sx={{ fontSize: { xs: 22, sm: 30 }, fontWeight: 700, color: colors.text }}>
                  {s.title}
                </Box>
                <Box sx={{ mt: 1, fontSize: { xs: 16, sm: 18 }, color: colors.textSecondary }}>
                  {s.body}
                </Box>
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>

      <Reveal>
        <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 10 } }}>
          <Box
            component="h2"
            sx={{ m: 0, mb: 3, fontSize: { xs: 26, sm: 38 }, fontWeight: 700, color: colors.text }}
          >
            {landingCopy.finalHeadline}
          </Box>
          <Ctas />
        </Box>
      </Reveal>
      <LandingFooter />
    </>
  );
};

export default LandingVariantC;
