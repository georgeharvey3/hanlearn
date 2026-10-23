// PROTOTYPE (#413): helpers the three new-word variants share. Throwaway;
// lives on the prototype/new-words-413 branch only.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';

import { searchWord } from '../../../../services/dictionaryService';
import { decomposeCharacter } from '../../../../services/decompositionService';
import * as ttsService from '../../../../services/ttsService';
import { loadCharData, onCharDataError } from '../../../../utils/charDataLoader';
import { parseMeanings } from '../../../../utils/meaningUtils';
import { toneMarks } from '../../../../utils/pinyinMarks';
import { makeDirections } from '../../../../utils/directions';
import { colors } from '../../../../theme';
import { RootState } from '../../../../types/store';
import { Word } from '../../../../types/models';

// Prototype strings. The real copy goes in src/copy.ts when a variant wins.
export const protoCopy = {
  stage: 'New words',
  next: 'Next word',
  back: 'Back',
  start: 'Start test',
  continue: 'Continue',
  skip: 'Skip',
  replay: 'Replay',
  characters: 'Characters',
  parts: 'Parts',
  strokes: 'Strokes',
  meaning: 'Meaning',
  trace: 'Trace it',
  traced: 'Traced',
  wordOf: (n: number, total: number) => `Word ${n} of ${total}`,
  noParts: 'No parts',
};

/** The /tryout demo has one word; the prototype needs a few to page through. */
export function sampleWords(): Word[] {
  const due = new Date().toISOString();
  const w = (id: number, simp: string, trad: string, pinyin: string, meaning: string): Word => ({
    id,
    simp,
    trad,
    pinyin,
    meaning,
    due_date: due,
    level: 1,
    directions: makeDirections(1, due),
  });
  return [
    w(0, '图书馆', '圖書館', 'tu2 shu1 guan3', 'library/CL:家[jia1],個|个[ge4]'),
    w(1, '电脑', '電腦', 'dian4 nao3', 'computer/CL:臺|台[tai2]'),
    w(2, '休息', '休息', 'xiu1 xi5', 'rest/to take a break'),
  ];
}

export function useCharSet(): 'simp' | 'trad' {
  return (localStorage.getItem('charSet') as 'simp' | 'trad') || 'trad';
}

export const marks = (pinyin: string): string => (pinyin ? toneMarks(pinyin) : '');
export const meanings = (meaning: string): string[] => parseMeanings(meaning);

export interface CharInfo {
  char: string;
  pinyins: string[];
  meanings: string[];
}

// The dictionary lookup is a Cloud Function too; the same fallback applies.
const stub = (char: string, pinyin: string, meaning: string): [string, CharInfo] => [
  char,
  { char, pinyins: [pinyin], meanings: meaning.split(' · ') },
];
const STUB_CHARS: Record<string, CharInfo> = Object.fromEntries([
  stub('图', 'tú', 'diagram · picture · to plan'),
  stub('圖', 'tú', 'diagram · picture · to plan'),
  stub('书', 'shū', 'book · letter · to write'),
  stub('書', 'shū', 'book · letter · to write'),
  stub('馆', 'guǎn', 'building · shop · hall'),
  stub('館', 'guǎn', 'building · shop · hall'),
  stub('电', 'diàn', 'electric · electricity'),
  stub('電', 'diàn', 'electric · electricity'),
  stub('脑', 'nǎo', 'brain · mind · head'),
  stub('腦', 'nǎo', 'brain · mind · head'),
  stub('休', 'xiū', 'to rest · to stop'),
  stub('息', 'xī', 'breath · news · to rest'),
]);

/** Dictionary entries for each character of the word, looked up once. */
export function useCharInfos(chars: string[], charSet: 'simp' | 'trad'): CharInfo[] {
  const [infos, setInfos] = useState<CharInfo[]>([]);
  const key = chars.join('');
  useEffect(() => {
    let live = true;
    Promise.all(
      chars.map(async (char) => {
        try {
          const results = await searchWord(char, charSet);
          if (results.length === 0) throw new Error('no entry');
          return {
            char,
            pinyins: Array.from(new Set(results.map((r) => marks(r.pinyin)))),
            meanings: Array.from(new Set(results.flatMap((r) => meanings(r.meaning)))).slice(0, 4),
          };
        } catch {
          return STUB_CHARS[char] ?? { char, pinyins: [], meanings: [] };
        }
      }),
    ).then((r) => live && setInfos(r));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, charSet]);
  return infos;
}

export interface Part {
  char: string;
  meaning: string | null;
  pinyin: string | null;
}

// The decomposition function needs the emulators. Without them the
// prototype falls back to these, so /tryout still shows the parts.
const STUB_PARTS: Record<string, Part[]> = {
  图: [
    { char: '囗', meaning: 'enclosure', pinyin: 'wéi' },
    { char: '冬', meaning: 'winter', pinyin: 'dōng' },
  ],
  圖: [
    { char: '囗', meaning: 'enclosure', pinyin: 'wéi' },
    { char: '啚', meaning: 'granary', pinyin: 'bǐ' },
  ],
  书: [],
  書: [
    { char: '聿', meaning: 'brush', pinyin: 'yù' },
    { char: '曰', meaning: 'to say', pinyin: 'yuē' },
  ],
  馆: [
    { char: '饣', meaning: 'food', pinyin: 'shí' },
    { char: '官', meaning: 'official', pinyin: 'guān' },
  ],
  館: [
    { char: '食', meaning: 'food', pinyin: 'shí' },
    { char: '官', meaning: 'official', pinyin: 'guān' },
  ],
  电: [],
  電: [
    { char: '雨', meaning: 'rain', pinyin: 'yǔ' },
    { char: '电', meaning: 'lightning', pinyin: 'diàn' },
  ],
  脑: [
    { char: '月', meaning: 'flesh', pinyin: 'yuè' },
    { char: '㐫', meaning: 'brain (old form)', pinyin: null },
  ],
  腦: [
    { char: '月', meaning: 'flesh', pinyin: 'yuè' },
    { char: '𡿺', meaning: 'brain (old form)', pinyin: null },
  ],
  休: [
    { char: '亻', meaning: 'person', pinyin: 'rén' },
    { char: '木', meaning: 'tree', pinyin: 'mù' },
  ],
  息: [
    { char: '自', meaning: 'self / nose', pinyin: 'zì' },
    { char: '心', meaning: 'heart', pinyin: 'xīn' },
  ],
};

/** The first level of a character's parts. */
export function useParts(char: string | null): Part[] | null {
  const [parts, setParts] = useState<Part[] | null>(null);
  useEffect(() => {
    if (!char) return;
    let live = true;
    setParts(null);
    decomposeCharacter(char)
      .then((r) => live && setParts(r))
      .catch(() => live && setParts(STUB_PARTS[char] ?? []));
    return () => {
      live = false;
    };
  }, [char]);
  return parts;
}

/** Play a text through the app's TTS, with a loading flag. */
export function useSpeak(): { speak: (text: string) => void; loading: boolean } {
  const voice = useSelector((s: RootState) => s.settings.voice);
  const lang = useSelector((s: RootState) => s.settings.lang);
  const [loading, setLoading] = useState(false);
  const speak = useCallback(
    (text: string) => {
      setLoading(true);
      try {
        ttsService.speak(text, {
          fallbackVoice: voice,
          fallbackLang: lang || 'zh-CN',
          onStart: () => setLoading(false),
          onEnd: () => setLoading(false),
          onError: () => setLoading(false),
        });
      } catch {
        setLoading(false);
      }
    },
    [lang, voice],
  );
  return { speak, loading };
}

interface StrokesProps {
  char: string;
  size: number;
  /** `animate` plays the strokes; `quiz` lets the learner trace them. */
  mode?: 'animate' | 'quiz';
  /** Bump to replay the animation. */
  replayKey?: number;
  onQuizDone?: () => void;
}

/** Hanzi Writer in a box with the guide lines of the handwriting field. */
export const Strokes: React.FC<StrokesProps> = ({
  char,
  size,
  mode = 'animate',
  replayKey = 0,
  onQuizDone,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onQuizDone);
  done.current = onQuizDone;

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.HanziWriter) return;
    el.innerHTML = '';
    try {
      const writer = window.HanziWriter.create(el, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        showOutline: true,
        showCharacter: false,
        strokeColor: colors.text,
        outlineColor: colors.outline,
        drawingColor: colors.primaryDark,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 180,
        showHintAfterMisses: 2,
        charDataLoader: loadCharData,
        onLoadCharDataError: onCharDataError,
      });
      if (mode === 'animate') writer.animateCharacter();
      else writer.quiz({ onComplete: () => done.current?.() });
    } catch {
      // Hanzi Writer has no data for some characters.
    }
    return () => {
      el.innerHTML = '';
    };
  }, [char, size, mode, replayKey]);

  const line = `1px dashed ${colors.gridLine}`;
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        bgcolor: colors.card,
        border: `1px solid ${colors.divider}`,
        borderRadius: 1,
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          pointerEvents: 'none',
        },
        '&::before': { left: '50%', top: 0, bottom: 0, borderLeft: line },
        '&::after': { top: '50%', left: 0, right: 0, borderTop: line },
      }}
    >
      <Box ref={ref} sx={{ position: 'relative', zIndex: 1, width: size, height: size }} />
    </Box>
  );
};
