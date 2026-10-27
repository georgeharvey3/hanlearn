import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { hanziSx } from '../Study/parts';
import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { loadCharData, onCharDataError } from '../../../utils/charDataLoader';
import { parseMeanings } from '../../../utils/meaningUtils';
import { Word } from '../../../types/models';

const TRACE_SIZE = 260;
/** How long the traced character stays in the box while it flashes, as in the test. */
const FLASH_MS = 1000;

/** A Hanzi Writer quiz in a box with the guide lines of the handwriting field. */
const TraceBox: React.FC<{ char: string; onDone: () => void }> = ({ char, onDone }) => {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.HanziWriter) return;
    el.innerHTML = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const writer = window.HanziWriter.create(el, char, {
        width: TRACE_SIZE,
        height: TRACE_SIZE,
        padding: Math.round(TRACE_SIZE * 0.06),
        showOutline: true,
        showCharacter: false,
        strokeColor: colors.text,
        outlineColor: colors.outline,
        drawingColor: colors.primaryDark,
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        highlightCompleteColor: colors.primaryDark,
        charDataLoader: loadCharData,
        onLoadCharDataError: onCharDataError,
      });
      // The box stays while Hanzi Writer flashes the finished character, so the
      // learner sees the whole character before the next one replaces it.
      writer.quiz({
        onComplete: () => {
          timer = setTimeout(() => done.current(), FLASH_MS);
        },
      });
    } catch {
      // Hanzi Writer has no data for some characters. Skip passes the step.
    }
    return () => {
      clearTimeout(timer);
      el.innerHTML = '';
    };
  }, [char]);

  const line = `1px dashed ${colors.gridLine}`;
  return (
    <Box
      role="img"
      aria-label={copy.newWords.traceHere(char)}
      sx={{
        position: 'relative',
        width: TRACE_SIZE,
        height: TRACE_SIZE,
        flex: 'none',
        boxSizing: 'border-box',
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
        overflow: 'hidden',
        '&::before, &::after': { content: '""', position: 'absolute', pointerEvents: 'none' },
        '&::before': { left: '50%', top: 0, bottom: 0, borderLeft: line },
        '&::after': { top: '50%', left: 0, right: 0, borderTop: line },
      }}
    >
      <Box ref={ref} sx={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }} />
    </Box>
  );
};

interface WriteStepProps {
  word: Word;
  charSet: 'simp' | 'trad';
  /** The learner traced the word before, so the step opens as traced. */
  traced: boolean;
  /** The learner traced every character. The step records no result. */
  onTraced: () => void;
}

/** Step 3: trace each character of the word in turn. */
const WriteStep: React.FC<WriteStepProps> = ({ word, charSet, traced: tracedBefore, onTraced }) => {
  const chars = useMemo(() => word[charSet].split(''), [word, charSet]);
  const [at, setAt] = useState(tracedBefore ? chars.length : 0);
  const traced = at >= chars.length;

  useEffect(() => {
    if (traced) onTraced();
  }, [traced, onTraced]);

  return (
    <>
      <Box sx={{ mt: 3, textAlign: 'center', fontSize: 15, color: colors.textSecondary }}>
        {copy.newWords.writePrompt}
        <Box component="span" sx={{ color: colors.primaryLight, fontWeight: 600 }}>
          {parseMeanings(word.meaning)[0]}
        </Box>
      </Box>
      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center', gap: 1 }}>
        {chars.map((char, i) => (
          <Box
            key={i}
            lang="zh"
            sx={hanziSx(28, {
              width: 44,
              height: 44,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              color: i < at ? colors.primaryDark : i === at ? colors.text : colors.disabledText,
              bgcolor: i < at ? colors.successSurface : 'transparent',
              border: `1px solid ${i === at ? colors.borderStrong : 'transparent'}`,
            })}
          >
            {char}
          </Box>
        ))}
      </Box>
      <Box sx={{ alignSelf: 'center', mt: 1.5 }}>
        {traced ? (
          <Box
            sx={{
              width: TRACE_SIZE,
              height: TRACE_SIZE,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              color: colors.primaryDark,
              fontWeight: 600,
            }}
          >
            <CheckRoundedIcon sx={{ fontSize: 48 }} />
            {copy.newWords.traced}
          </Box>
        ) : (
          <TraceBox key={at} char={chars[at]} onDone={() => setAt((n) => n + 1)} />
        )}
      </Box>
    </>
  );
};

export default WriteStep;
