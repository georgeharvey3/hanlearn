import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';

import { copy } from '../../../copy';
import { colors } from '../../../theme';
import { DirectionResult, Word, WordScore } from '../../../types/models';
import StudyScreen from '../Study/StudyScreen';
import StudyTop from '../Study/StudyTop';
import { StudyButton } from '../Study/parts';
import ScoreCard from './ScoreCard';
import WordTile from './WordTile';
import { missedWords, summaryRows, tally } from './summary';

interface TestSummaryProps {
  scores: WordScore[];
  /** The session's words, for the pinyin and meaning on the back of each tile. */
  words: Word[];
  practiceMode: boolean;
  onHome: () => void;
  /** Starts a practice session of the words with a Nearly or Not known question. */
  onPracticeMissed: (words: Word[]) => void;
}

/**
 * The end of a session: the score card, then one tile for each question with
 * the missed ones first. The session bar and the buttons stay put, and the
 * card and tiles scroll between them when a long session overflows.
 */
const TestSummary: React.FC<TestSummaryProps> = ({
  scores,
  words,
  practiceMode,
  onHome,
  onPracticeMissed,
}) => {
  const rows = useMemo(() => summaryRows(scores, words), [scores, words]);
  const counts = tally(rows);
  const [filter, setFilter] = useState<DirectionResult | null>(null);
  // The index in `rows` of the turned tile: one at a time.
  const [turned, setTurned] = useState<number | null>(null);

  // Whether the tiles overflow, and whether more of them lie below the fold:
  // the buttons get a rule above them, and the foot of the list a fade.
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ scrolls: false, more: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const scrolls = el.scrollHeight > el.clientHeight + 1;
    const more = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setOverflow((prev) =>
      prev.scrolls === scrolls && prev.more === more ? prev : { scrolls, more },
    );
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, filter]);

  const missed = counts.fail + counts.lapse > 0;

  return (
    <StudyScreen fixed>
      <StudyTop
        stage={copy.summary.stage}
        done={counts.total}
        total={counts.total}
        onEnd={onHome}
      />
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, mx: -2 }}>
        <Box
          ref={scroller}
          onScroll={measure}
          sx={{ height: '100%', overflowY: 'auto', px: 2, pb: 2, boxSizing: 'border-box' }}
        >
          <ScoreCard
            tally={counts}
            practiceMode={practiceMode}
            filter={filter}
            onFilter={(next) => {
              setFilter(next);
              setTurned(null);
            }}
          />
          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {rows.map((row, i) =>
              filter && row.result !== filter ? null : (
                <WordTile
                  key={i}
                  row={row}
                  turned={turned === i}
                  onClick={() => setTurned(turned === i ? null : i)}
                />
              ),
            )}
          </Box>
        </Box>
        {overflow.more && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 56,
              background: `linear-gradient(to bottom, rgba(250,248,245,0), ${colors.paper})`,
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      <Box
        sx={{
          mx: -2,
          px: 2,
          pt: 1.5,
          borderTop: `1px solid ${overflow.scrolls ? colors.divider : 'transparent'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        {missed && (
          <StudyButton onClick={() => onPracticeMissed(missedWords(rows, words))}>
            {copy.summary.practiseMissed}
          </StudyButton>
        )}
        <StudyButton variant="primary" onClick={onHome}>
          {copy.summary.backToDashboard}
        </StudyButton>
      </Box>
    </StudyScreen>
  );
};

export default TestSummary;
