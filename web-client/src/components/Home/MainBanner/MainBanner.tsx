import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useParallax } from '../../../hooks/useParallax';
import mountainsSvg from '../../../assets/images/homepage/mountains.jpg';
import { colors } from '../../../theme';

const sentences = [
  'Master Mandarin Vocabulary the Right Way',
  'Build lasting connections between characters, pronunciation, and meaning.',
  'Designed specifically for learners of Chinese.',
];

/** Determine which section (0, 1, 2) should be active based on scroll progress. */
const getActiveSection = (progress: number): number => {
  if (progress < 0.33) return 0;
  if (progress < 0.66) return 1;
  return 2;
};

const textBoxSx = {
  backgroundColor: alpha(colors.primaryDark, 0.7),
  backdropFilter: 'blur(8px)',
  mx: 'auto',
  p: { xs: 2.5, sm: 4 },
  borderRadius: 1,
  color: 'common.white',
  width: { xs: '90%', sm: '80%', lg: '50%' },
  textAlign: 'center',
};

const MainBanner: React.FC = () => {
  const { scrollProgress, sectionProgress, ref, outerRef } = useParallax();
  const [mounted, setMounted] = React.useState(false);
  const prefersReducedMotion = React.useMemo(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const isTouchDevice = 'ontouchstart' in window;
  const textSpeed = isTouchDevice ? 0.3 * 0.3 : 0.3;
  const textOffset = prefersReducedMotion ? 0 : scrollProgress * textSpeed * -100;
  const activeSection = prefersReducedMotion ? 0 : getActiveSection(sectionProgress);

  return (
    <Box
      ref={outerRef}
      id="main-banner"
      sx={{
        width: '100vw',
        position: 'relative',
        left: '50%',
        transform: 'translateX(-50%)',
        // Cancel the page's top gutter, so the banner meets the top bar.
        mt: { xs: '-16px', sm: '-32px' },
        height: { xs: 'auto', sm: '300vh', md: '500vh' },
      }}
    >
      <Box
        ref={ref}
        sx={{
          position: { xs: 'relative', sm: 'sticky' },
          top: { xs: 0, sm: '56px' },
          overflow: 'hidden',
          height: { xs: '80vh', sm: '85vh', md: '100vh' },
          background: `linear-gradient(
            180deg,
            #f0f4f0 0%,
            #e0ebe4 15%,
            #c8ddd0 35%,
            #a8ccb8 55%,
            #88bba4 75%,
            #6aaa90 100%
          )`,
        }}
      >
        {/* Mountains illustration */}
        <Box
          component="img"
          src={mountainsSvg}
          alt=""
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top',
            zIndex: 1,
          }}
        />

        {/* Text sections — upper third */}
        {sentences.map((text, i) => {
          const isActive = i === activeSection;
          return (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                pt: { xs: '12vh', sm: '14vh', md: '16vh' },
                zIndex: 10,
                transform: `translate3d(0, ${textOffset}px, 0)`,
                willChange: 'transform',
              }}
            >
              <Box
                sx={{
                  ...textBoxSx,
                  opacity: isActive && mounted ? 1 : 0,
                  transform: isActive && mounted ? 'translateY(0)' : 'translateY(30px)',
                  transition: prefersReducedMotion
                    ? 'none'
                    : 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  pointerEvents: isActive ? 'auto' : 'none',
                }}
              >
                <Typography
                  variant="h3"
                  sx={{ fontSize: { xs: '1.6rem', sm: '2.2rem', md: undefined } }}
                >
                  {text}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default MainBanner;
