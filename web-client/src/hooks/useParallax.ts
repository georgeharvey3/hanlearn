import { useState, useEffect, useRef, useCallback } from 'react';

export const useParallax = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sectionProgress, setSectionProgress] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);

  const handleScroll = useCallback(() => {
    if (rafId.current) return;

    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;

      if (ref.current) {
        const { top, height } = ref.current.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, -top / height));
        const rounded = Math.round(progress * 1000) / 1000;
        setScrollProgress(rounded);
      }

      if (outerRef.current) {
        const { top, height } = outerRef.current.getBoundingClientRect();
        const scrollableDistance = height - window.innerHeight;
        if (scrollableDistance > 0) {
          const progress = Math.min(1, Math.max(0, -top / scrollableDistance));
          const rounded = Math.round(progress * 1000) / 1000;
          setSectionProgress(rounded);
        }
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [handleScroll]);

  return { scrollProgress, sectionProgress, ref, outerRef };
};
