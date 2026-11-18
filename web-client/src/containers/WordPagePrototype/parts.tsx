// PROTOTYPE (#562): throwaway leaf parts that the three variants share. The
// layout of each variant is its own; only these small pieces are shared.
import React, { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';

import { colors, fonts, levelInk, partInk } from '../../theme';
import { Word, DIRECTIONS, Direction } from '../../types/models';
import { BANK_LABELS, isLeech } from '../../utils/scheduling';
import { DIRECTION_LABELS } from '../../utils/directions';
import { formatRelativeDueDate } from '../../utils/formatRelativeDueDate';
import { loadCharData } from '../../utils/charDataLoader';
import { getSegmentedSentence } from '../../services/sentenceService';
import { ResolvedSentence, SentenceWord, resolveSentence } from '../../utils/sentenceUtils';
import { Highlight, SentenceWordButton } from '../../components/Sentences/shared';
import WordGlossPanel from '../../components/Test/Study/WordGlossPanel';
import CharacterBreakdown from '../../components/Test/ComponentReview/CharacterBreakdown';
import { useBreakdown } from '../../components/Test/ComponentReview/useBreakdown';
import { Block } from '../../components/AddWords/BankStates';
import * as ttsService from '../../services/ttsService';
import { searchWord } from '../../services/dictionaryService';
import { toneMarks } from '../../utils/pinyinMarks';
import { p } from './prototypeCopy';

/** Everything a variant gets. The data layer above the switcher builds it. */
export interface PageData {
  entry: Word;
  /** The learner's word, or null when the learner does not have the entry. */
  owned: Word | null;
  otherReadings: Word[];
  listNames: string[];
  covered: boolean;
  charSet: 'simp' | 'trad';
  onShow: () => void;
  onAdd: () => void;
  onOpenReading: (word: Word) => void;
}

export const HANZI = /[㐀-鿿]/;
export const hanziOf = (text: string) => Array.from(text).filter((c) => HANZI.test(c));
export const sensesOf = (meaning: string) =>
  meaning
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
export const otherForm = (w: Word, charSet: 'simp' | 'trad') => {
  const other = charSet === 'trad' ? w.simp : w.trad;
  return other !== w[charSet] ? other : null;
};

export const hanzi = (size: number, extra?: object) => ({
  fontFamily: fonts.hanzi,
  fontSize: size,
  lineHeight: 1.1,
  fontWeight: 400,
  ...extra,
});

export const Overline: React.FC<{ children: React.ReactNode; sx?: object }> = ({
  children,
  sx,
}) => (
  <Box
    sx={{
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      ...sx,
    }}
  >
    {children}
  </Box>
);

export const Speaker: React.FC<{ text: string; size?: number }> = ({ text, size = 44 }) => {
  const [playing, setPlaying] = useState(false);
  return (
    <IconButton
      aria-label={p.play}
      disabled={playing}
      onClick={() => {
        setPlaying(true);
        ttsService.speak(text, {
          onEnd: () => setPlaying(false),
          onError: () => setPlaying(false),
        });
      }}
      sx={{ width: size, height: size, border: `1px solid ${colors.borderStrong}`, color: colors.text }}
    >
      <VolumeUpOutlinedIcon sx={{ fontSize: size * 0.5 }} />
    </IconButton>
  );
};

export const AddButton: React.FC<{ onAdd: () => void; sx?: object }> = ({ onAdd, sx }) => (
  <ButtonBase
    onClick={onAdd}
    sx={{
      height: 44,
      px: 2.5,
      borderRadius: 1,
      bgcolor: colors.primaryDark,
      color: colors.white,
      fontFamily: fonts.body,
      fontSize: 15,
      fontWeight: 600,
      ...sx,
    }}
  >
    {p.add}
  </ButtonBase>
);

export const LevelPips: React.FC<{ level: number; size?: number }> = ({ level, size = 6 }) => (
  <Box component="span" role="img" aria-label={BANK_LABELS[level]} sx={{ display: 'flex', gap: '2px' }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Box
        key={i}
        component="span"
        sx={{
          width: size,
          height: size,
          boxSizing: 'border-box',
          borderRadius: '1px',
          bgcolor: i <= level ? levelInk[level - 1] : colors.blankDay,
          border: i <= level ? 'none' : `1px solid ${colors.divider}`,
        }}
      />
    ))}
  </Box>
);

export const LeechChip: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 0.5,
      fontSize: size,
      fontWeight: 600,
      color: colors.warningText,
    }}
  >
    <WarningAmberRoundedIcon aria-hidden sx={{ fontSize: size + 2 }} />
    {'Hard to recall'}
  </Box>
);

export interface DirectionRow {
  direction: Direction;
  label: string;
  level: number;
  due: string;
  lapses: number;
  leech: boolean;
}

export const directionRows = (w: Word): DirectionRow[] =>
  DIRECTIONS.map((direction) => {
    const s = w.directions?.[direction];
    return {
      direction,
      label: DIRECTION_LABELS[direction],
      level: s?.level ?? 1,
      due: s?.dueDate ? formatRelativeDueDate(s.dueDate) : '',
      lapses: s?.lapses ?? 0,
      leech: isLeech(s?.lapses),
    };
  });

export const nextDue = (w: Word) => (w.due_date ? formatRelativeDueDate(w.due_date) : '');

/** The cover of a word due soon: grey blocks and one control. */
export const Cover: React.FC<{ onShow: () => void }> = ({ onShow }) => (
  <ButtonBase
    onClick={onShow}
    aria-label={p.showWord}
    sx={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      py: 6,
      fontFamily: fonts.body,
    }}
  >
    <Block width={140} height={72} />
    <Block width={96} height={14} />
    <Block width={220} height={12} />
    <Block width={180} height={12} />
    <Box sx={{ fontSize: 13, color: colors.textSecondary, mt: 1 }}>{p.dueSoon}</Box>
    <Box
      sx={{
        mt: 1,
        px: 2.5,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 1,
        border: `1px solid ${colors.borderStrong}`,
        fontSize: 15,
        fontWeight: 600,
        color: colors.text,
      }}
    >
      {p.showWord}
    </Box>
  </ButtonBase>
);

/**
 * The stroke animation of one character. It plays once when it comes into
 * view, and a tap plays it again.
 */
export const StrokePlayer: React.FC<{ char: string; size: number; grid?: boolean }> = ({
  char,
  size,
  grid = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriterInstance | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.HanziWriter) return undefined;
    el.innerHTML = '';
    let played = false;
    try {
      writer.current = window.HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        showOutline: true,
        showCharacter: false,
        strokeColor: colors.text,
        outlineColor: colors.outline,
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 120,
        charDataLoader: loadCharData,
      });
    } catch {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!played && entries.some((e) => e.isIntersecting)) {
          played = true;
          writer.current?.animateCharacter();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.innerHTML = '';
      writer.current = null;
    };
  }, [char, size]);

  const line = `1px dashed ${colors.gridLine}`;
  return (
    <ButtonBase
      aria-label={p.replay(char)}
      onClick={() => writer.current?.animateCharacter()}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
      }}
    >
      {grid && (
        <>
          <Box sx={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: line }} />
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: '50%', borderLeft: line }} />
        </>
      )}
      <Box ref={ref} sx={{ position: 'relative', width: size, height: size }} />
    </ButtonBase>
  );
};

/** The breakdown of a character, or nothing when it has none: no placeholder. */
export const MaybeBreakdown: React.FC<{ char: string }> = ({ char }) => {
  const [load] = useBreakdown(char);
  if (load.status !== 'done' || !load.breakdown.p || load.breakdown.p.length === 0) return null;
  return <CharacterBreakdown char={char} />;
};

/** Whether a breakdown exists, for a variant that lays out around it. */
export const useHasBreakdown = (char: string) => {
  const [load] = useBreakdown(char);
  return load.status === 'done' && !!load.breakdown.p && load.breakdown.p.length > 0;
};

/** The first sentence of the word, in file order, or null when it has none. */
export const useFirstSentence = (word: Word, charSet: 'simp' | 'trad') => {
  const [sentence, setSentence] = useState<ResolvedSentence | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getSegmentedSentence(word.simp, charSet)
      .then(({ sentence: s }) => !cancelled && setSentence(s ? resolveSentence(s, charSet) : null))
      .catch(() => !cancelled && setSentence(null));
    return () => {
      cancelled = true;
    };
  }, [word.simp, charSet]);
  return sentence;
};

/** The sentence: the word highlighted, each segment tappable, the English under it. */
export const SentenceView: React.FC<{
  sentence: ResolvedSentence;
  charSet: 'simp' | 'trad';
  word: Word;
  size?: number;
  pinyin?: boolean;
}> = ({ sentence, charSet, word, size = 24, pinyin = false }) => {
  const [open, setOpen] = useState<SentenceWord | null>(null);
  const button = (entry: SentenceWord, key: React.Key) => (
    <SentenceWordButton
      key={key}
      entry={entry}
      charSet={charSet}
      open={open === entry}
      onClick={() => setOpen(open === entry ? null : entry)}
    />
  );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          component="p"
          lang="zh"
          sx={{ m: 0, flex: 1, fontFamily: fonts.hanzi, fontSize: size, lineHeight: 1.6 }}
        >
          {sentence.chinese.words.map((segment, i) => {
            if (i === sentence.chinese.targetIndex) {
              return (
                <Highlight key={i}>
                  {sentence.chinese.target ? button(sentence.chinese.target, 't') : word[charSet]}
                </Highlight>
              );
            }
            if (typeof segment === 'string') return <React.Fragment key={i}>{segment}</React.Fragment>;
            return button(segment, i);
          })}
        </Box>
        <Speaker text={sentence.chinese.sentence} size={36} />
      </Box>
      {pinyin && (
        <Box lang="zh-Latn" sx={{ fontSize: 14, color: colors.textSecondary }}>
          {sentence.chinese.pinyin}
        </Box>
      )}
      <Box sx={{ fontSize: 15, color: colors.textSecondary }}>{sentence.english.sentence}</Box>
      <WordGlossPanel
        word={open}
        charSet={charSet}
        added={false}
        onSpeak={(text) => ttsService.speak(text)}
      />
    </Box>
  );
};

// ---- Opposite character set and the meanings of the characters (round 2) ----

/** One reading of one character: pinyin in tone marks and its senses. */
export interface CharReading {
  pinyin: string;
  senses: string[];
}

/** The readings of a character, the one this word uses first. */
export interface CharInfo {
  /** The reading of the character in this word, when one matches the syllable. */
  inWord: CharReading | null;
  others: CharReading[];
  failed?: boolean;
}

const readingCache = new Map<string, Promise<CharReading[]>>();
const readingsOf = (char: string, charSet: 'simp' | 'trad') => {
  const key = `${charSet}:${char}`;
  let hit = readingCache.get(key);
  if (!hit) {
    hit = searchWord(char, charSet).then((rows) =>
      rows
        .filter((r) => r[charSet] === char)
        .map((r) => ({ pinyin: toneMarks(r.pinyin), senses: sensesOf(r.meaning) })),
    );
    readingCache.set(key, hit);
    hit.catch(() => readingCache.delete(key));
  }
  return hit;
};

const fold = (s: string) => s.normalize('NFC').toLowerCase().trim();

/**
 * The readings of each character of the word, split into the one the word
 * uses (matched on the syllable at its place) and the rest.
 */
export const useCharInfo = (word: Word, charSet: 'simp' | 'trad') => {
  const chars = hanziOf(word[charSet]);
  const syllables = word.pinyin.split(/\s+/);
  const key = `${charSet}:${chars.join('')}:${word.pinyin}`;
  const [info, setInfo] = useState<{ key: string; byIndex: (CharInfo | undefined)[] }>({
    key,
    byIndex: [],
  });
  useEffect(() => {
    let cancelled = false;
    chars.forEach((char, i) => {
      readingsOf(char, charSet)
        .then((readings) => {
          const syl = syllables.length === chars.length ? fold(syllables[i]) : null;
          const exact = syllables.length === chars.length ? syllables[i].normalize('NFC') : null;
          // An exact match first, so 書 shū (book) wins over 書 Shū (surname).
          const match = syl
            ? readings.find((r) => r.pinyin.normalize('NFC') === exact) ??
              readings.find((r) => fold(r.pinyin) === syl) ??
              null
            : null;
          const value: CharInfo = { inWord: match, others: readings.filter((r) => r !== match) };
          if (!cancelled)
            setInfo((prev) => {
              const byIndex = prev.key === key ? [...prev.byIndex] : [];
              byIndex[i] = value;
              return { key, byIndex };
            });
        })
        .catch(() => {
          if (!cancelled)
            setInfo((prev) => {
              const byIndex = prev.key === key ? [...prev.byIndex] : [];
              byIndex[i] = { inWord: null, others: [], failed: true };
              return { key, byIndex };
            });
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (i: number): CharInfo | undefined => (info.key === key ? info.byIndex[i] : undefined);
};

/** The senses to show for a character in this word: its matching reading, or the first. */
export const wordSenses = (info: CharInfo | undefined, n = 3): string => {
  if (!info) return '';
  if (info.failed) return 'Definition unavailable';
  const r = info.inWord ?? info.others[0];
  return r ? r.senses.slice(0, n).join(' · ') : '';
};

export const formName = (set: 'simp' | 'trad') => (set === 'trad' ? 'Traditional' : 'Simplified');
export const otherSet = (set: 'simp' | 'trad'): 'simp' | 'trad' => (set === 'trad' ? 'simp' : 'trad');
export const formsDiffer = (w: Word) => w.simp !== w.trad;

/** A two-way switch between the traditional and simplified forms of the word. */
export const FormToggle: React.FC<{
  word: Word;
  value: 'simp' | 'trad';
  onChange: (set: 'simp' | 'trad') => void;
  size?: number;
}> = ({ word, value, onChange, size = 18 }) => (
  <Box
    role="radiogroup"
    sx={{
      display: 'inline-flex',
      border: `1px solid ${colors.borderStrong}`,
      borderRadius: 999,
      p: '2px',
      bgcolor: colors.card,
    }}
  >
    {(['trad', 'simp'] as const).map((set) => (
      <ButtonBase
        key={set}
        role="radio"
        aria-checked={value === set}
        aria-label={formName(set)}
        onClick={() => onChange(set)}
        sx={{
          px: 1.5,
          height: 32,
          borderRadius: 999,
          bgcolor: value === set ? colors.text : 'transparent',
          color: value === set ? colors.white : colors.text,
          gap: 0.75,
          fontFamily: fonts.body,
        }}
      >
        <Box component="span" lang="zh" sx={hanzi(size)}>
          {word[set]}
        </Box>
        <Box component="span" sx={{ fontSize: 11, opacity: 0.8 }}>
          {set === 'trad' ? 'Trad' : 'Simp'}
        </Box>
      </ButtonBase>
    ))}
  </Box>
);

// ---- One panel for the strokes and the parts (round 3, toggle in round 4) ----

/** The size of the panel character: the size CharacterBreakdown draws at. */
const STUDIO_SIZE = 168;

interface StrokeGeometry {
  strokes: string[];
  medians: number[][][];
}

const geometryCache = new Map<string, Promise<StrokeGeometry>>();
const geometryOf = (char: string) => {
  let hit = geometryCache.get(char);
  if (!hit) {
    hit = new Promise<StrokeGeometry>((resolve, reject) =>
      loadCharData(char, (data) => resolve(data as StrokeGeometry), reject),
    );
    geometryCache.set(char, hit);
    hit.catch(() => geometryCache.delete(char));
  }
  return hit;
};

const lengthOf = (median: number[][]) =>
  median.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - median[i][0], y - median[i][1]), 0);

/** Animation timing, in the units of the 1024 box. */
const MS_PER_UNIT = 0.9;
const MIN_STROKE_MS = 250;
const GAP_MS = 120;

/**
 * The character drawn as plain SVG, in one ink or in the inks of its parts.
 * With `play`, each stroke is brushed in order along its median, the way
 * Hanzi Writer draws, so both views share one animation.
 */
const InkCharacter: React.FC<{
  id: string;
  geometry: StrokeGeometry;
  inkOf: (stroke: number) => string;
  play: number;
}> = ({ id, geometry, inkOf, play }) => {
  let at = 0;
  const timing = geometry.medians.map((median) => {
    const length = lengthOf(median);
    const ms = Math.max(MIN_STROKE_MS, length * MS_PER_UNIT);
    const t = { length, delay: at, ms };
    at += ms + GAP_MS;
    return t;
  });
  return (
    <svg viewBox="0 0 1024 1024" width={STUDIO_SIZE} height={STUDIO_SIZE} aria-hidden="true">
      <style>{`@keyframes brush-${id} { to { stroke-dashoffset: 0; } }`}</style>
      <g transform="translate(0, 900) scale(1, -1)">
        {play > 0 &&
          geometry.strokes.map((d, i) => <path key={`o${i}`} d={d} fill={colors.outline} />)}
        {geometry.strokes.map((d, i) =>
          play === 0 ? (
            <path key={i} d={d} fill={inkOf(i)} />
          ) : (
            <g key={`${play}-${i}`}>
              <clipPath id={`${id}-clip-${i}`}>
                <path d={d} />
              </clipPath>
              <polyline
                clipPath={`url(#${id}-clip-${i})`}
                points={geometry.medians[i].map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={inkOf(i)}
                strokeWidth={200}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={timing[i].length + 200}
                strokeDashoffset={timing[i].length + 200}
                style={{
                  animation: `brush-${id} ${timing[i].ms}ms linear ${timing[i].delay}ms forwards`,
                }}
              />
            </g>
          ),
        )}
      </g>
    </svg>
  );
};

const totalMs = (g: StrokeGeometry) =>
  g.medians.reduce((sum, m) => sum + Math.max(MIN_STROKE_MS, lengthOf(m) * MS_PER_UNIT) + GAP_MS, 0);

/** A labelled on/off switch. */
const ViewSwitch: React.FC<{ label: string; on: boolean; onChange: (on: boolean) => void }> = ({
  label,
  on,
  onChange,
}) => (
  <ButtonBase
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    sx={{ height: 36, px: 1, gap: 1, borderRadius: 1, fontFamily: fonts.body, fontSize: 13, fontWeight: 600 }}
  >
    {label}
    <Box
      component="span"
      sx={{
        width: 34,
        height: 20,
        borderRadius: 10,
        p: '2px',
        boxSizing: 'border-box',
        bgcolor: on ? colors.primaryDark : colors.borderStrong,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background-color 120ms',
      }}
    >
      <Box component="span" sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: colors.white }} />
    </Box>
  </ButtonBase>
);

/**
 * The strokes and the parts of a character in one panel. "Composition" picks
 * the view: the parts in their inks (tappable, as after a CM lapse), or the
 * character in plain ink. "Animate" draws the strokes in order in the chosen
 * view, then shows that view at rest again. A character with no breakdown has
 * no Composition switch: it is always in ink.
 */
export const CharacterStudio: React.FC<{ char: string }> = ({ char }) => {
  const [load] = useBreakdown(char);
  const parts = load.status === 'done' && load.breakdown.p && load.breakdown.p.length > 0 ? load.breakdown.p : null;
  const [composition, setComposition] = useState(true);
  const [geometry, setGeometry] = useState<StrokeGeometry | null>(null);
  const [play, setPlay] = useState(0);
  const [animating, setAnimating] = useState(false);
  const id = `studio-${char.codePointAt(0)!.toString(16)}`;

  useEffect(() => {
    let cancelled = false;
    geometryOf(char)
      .then((g) => !cancelled && setGeometry(g))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [char]);

  useEffect(() => {
    if (!animating || !geometry) return undefined;
    const timer = setTimeout(() => setAnimating(false), totalMs(geometry));
    return () => clearTimeout(timer);
  }, [animating, geometry, play]);

  const showParts = composition && !!parts;
  const partOf = new Map<number, number>();
  parts?.forEach((part, index) => part.s.forEach((stroke) => partOf.set(stroke, index)));
  const inkOf = (stroke: number) =>
    showParts ? partInk[(partOf.get(stroke) ?? 0) % partInk.length] : colors.text;

  const animate = () => {
    setPlay((n) => n + 1);
    setAnimating(true);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', minWidth: STUDIO_SIZE, minHeight: STUDIO_SIZE }}>
        {/* No part takes a tap while the strokes draw. */}
        {showParts && (
          <Box aria-disabled={animating} sx={{ pointerEvents: animating ? 'none' : 'auto' }}>
            <CharacterBreakdown char={char} />
          </Box>
        )}
        {geometry && (animating || !showParts) && (
          <Box
            sx={{
              position: showParts ? 'absolute' : 'static',
              top: 0,
              left: '50%',
              transform: showParts ? 'translateX(-50%)' : 'none',
              width: STUDIO_SIZE,
              height: STUDIO_SIZE,
              bgcolor: colors.paper,
            }}
          >
            <InkCharacter id={id} geometry={geometry} inkOf={inkOf} play={animating ? play : 0} />
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
        {parts && <ViewSwitch label={p.composition} on={composition} onChange={setComposition} />}
        <ButtonBase
          onClick={animate}
          disabled={animating || !geometry}
          sx={{
            height: 36,
            px: 1.75,
            gap: 0.75,
            borderRadius: 999,
            border: `1px solid ${colors.borderStrong}`,
            bgcolor: colors.card,
            fontFamily: fonts.body,
            fontSize: 13,
            fontWeight: 600,
            color: animating ? colors.disabledText : colors.text,
          }}
        >
          <PlayArrowRoundedIcon sx={{ fontSize: 18 }} />
          {p.animate}
        </ButtonBase>
      </Box>
    </Box>
  );
};
