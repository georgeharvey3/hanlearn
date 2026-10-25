// PROTOTYPE (#407): the state, the copy and the controls the three Settings
// variants share. The state starts from the learner's real localStorage
// values, but every change stays in memory. Throwaway; lives on
// prototype/settings-407 only.
import React, { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { colors, fonts } from '../../../theme';
import {
  assumedNewWordCount,
  assumedWriteWordCount,
  estimateTestTime,
  formatTestTime,
  spreadOverDirections,
} from '../../../utils/estimateTestTime';
import { eligibleDirections } from '../../Test/Logic/TestLogic';
import {
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  QUESTIONS_PER_SESSION_STEP,
  readQuestionsPerSession,
} from '../../../utils/sessionSettings';
import { QuizType, getQuizType } from '../../../utils/audioSettings';

export { QUESTIONS_PER_SESSION_MAX, QUESTIONS_PER_SESSION_MIN, QUESTIONS_PER_SESSION_STEP };

// One copy object, so the chosen variant's strings move to src/copy.ts whole.
export const pc = {
  title: 'Settings',
  // Sections
  session: 'Session',
  answers: 'Answers',
  skills: 'Skills',
  stages: 'Stages',
  sound: 'Sound',
  script: 'Characters',
  account: 'Account',
  // Session
  questions: 'Questions',
  questionsPerSession: 'Questions per session',
  // formatTestTime gives "~12 min".
  minutes: (t: string) => t.replace('~', 'About '),
  fewer: 'Fewer questions',
  more: 'More questions',
  // Script
  simp: 'Simplified',
  trad: 'Traditional',
  // Answers
  meaning: 'Meaning',
  pinyin: 'Pinyin',
  input: 'Type',
  flashcard: 'Flashcard',
  handwriting: 'Handwriting',
  autoRecord: 'Auto-start microphone',
  // Skills (the directions, by the learner's name for them)
  listening: 'Listening',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  focus: 'Focus',
  noFocus: 'No focus',
  onlyFocus: 'Only this skill',
  // Stages
  newWords: 'New words',
  test: 'Test',
  sentenceRead: 'Translate sentences',
  sentenceWrite: 'Make sentences',
  allWords: 'Translate with all words',
  // Sound
  tts: 'Text-to-speech',
  effects: 'Sound effects',
  // Account
  signedInAs: 'Signed in as',
  notSignedIn: 'Not signed in',
  logout: 'Log out',
  resetPassword: 'Reset password',
  // States
  unsupported: 'Not supported in this browser',
  needsHandwriting: 'Turn on handwriting first',
  needsRead: 'Turn on Translate sentences first',
  needsInput: 'Set Meaning or Pinyin to Type first',
  sheetTitle: 'Test settings',
  back: 'Back',
  on: 'On',
  off: 'Off',
} as const;

export type Priority = 'none' | 'MP' | 'PM' | 'MC' | 'CM';

export interface ProtoSettings {
  charSet: 'simp' | 'trad';
  questionsPerSession: number;
  useHandwriting: boolean;
  useSound: boolean;
  useSoundEffects: boolean;
  useAutoRecord: boolean;
  meaningQuizType: QuizType;
  pinyinQuizType: QuizType;
  newWords: boolean;
  sentenceRead: boolean;
  sentenceWrite: boolean;
  sentenceStagesForAllWords: boolean;
  priority: Priority;
  onlyPriority: boolean;
}

export const SKILLS: { key: Exclude<Priority, 'none'>; label: string; hanzi: string }[] = [
  { key: 'MP', label: pc.listening, hanzi: '听' },
  { key: 'PM', label: pc.speaking, hanzi: '说' },
  { key: 'MC', label: pc.reading, hanzi: '读' },
  { key: 'CM', label: pc.writing, hanzi: '写' },
];

const flag = (key: string, fallback: boolean): boolean => {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === 'true';
};

const readAll = (): ProtoSettings => ({
  charSet: localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad',
  questionsPerSession: readQuestionsPerSession(),
  useHandwriting: flag('useHandwriting', true),
  useSound: flag('useSound', true),
  useSoundEffects: flag('useSoundEffects', true),
  useAutoRecord: flag('useAutoRecord', true),
  meaningQuizType: getQuizType('meaning'),
  pinyinQuizType: getQuizType('pinyin'),
  newWords: flag('newWords', true),
  sentenceRead: flag('sentenceRead', true),
  sentenceWrite: flag('sentenceWrite', true),
  sentenceStagesForAllWords: flag('sentenceStagesForAllWords', false),
  priority: (localStorage.getItem('priority') as Priority) || 'none',
  onlyPriority: flag('onlyPriority', false),
});

export interface Env {
  speechAvailable: boolean;
  synthAvailable: boolean;
  email: string | null;
  onLogout: () => void;
}

/** The settings, their rules, and the derived values every variant shows. */
export const useProtoSettings = (env: Env) => {
  const [s, setS] = useState<ProtoSettings>(readAll);

  const set = useCallback(<K extends keyof ProtoSettings>(key: K, value: ProtoSettings[K]) => {
    setS((prev) => {
      const next = { ...prev, [key]: value };
      // The rules of the current page.
      if (key === 'useHandwriting' && !value && prev.priority === 'CM') next.priority = 'none';
      if (key === 'priority' && value === 'none') next.onlyPriority = false;
      return next;
    });
  }, []);

  const inputSelected = s.meaningQuizType === 'input' || s.pinyinQuizType === 'input';

  const disabled = {
    useSound: env.synthAvailable ? null : pc.unsupported,
    useAutoRecord: !env.speechAvailable ? pc.unsupported : !inputSelected ? pc.needsInput : null,
    newWords: env.synthAvailable ? null : pc.unsupported,
    sentenceRead: env.speechAvailable ? null : pc.unsupported,
    sentenceStagesForAllWords: s.sentenceRead && env.speechAvailable ? null : pc.needsRead,
    CM: s.useHandwriting ? null : pc.needsHandwriting,
    onlyPriority: s.priority === 'none' ? '' : null,
  };

  // What a control shows: a disabled control reads as off.
  const shown = {
    useSound: s.useSound && !disabled.useSound,
    useAutoRecord: s.useAutoRecord && !disabled.useAutoRecord,
    newWords: s.newWords && !disabled.newWords,
    sentenceRead: s.sentenceRead && !disabled.sentenceRead,
    sentenceStagesForAllWords: s.sentenceStagesForAllWords && !disabled.sentenceStagesForAllWords,
  };

  const directions = useMemo(
    () =>
      spreadOverDirections(
        s.questionsPerSession,
        eligibleDirections({
          includeHandwriting: s.useHandwriting,
          priority: s.priority,
          onlyPriority: s.onlyPriority,
        }),
      ),
    [s.questionsPerSession, s.useHandwriting, s.priority, s.onlyPriority],
  );

  const time = useMemo(
    () =>
      formatTestTime(
        estimateTestTime({
          directions,
          newWordCount: assumedNewWordCount(s.questionsPerSession),
          writeWordCount: assumedWriteWordCount(s.questionsPerSession),
          newWordsEnabled: shown.newWords,
          sentenceReadEnabled: shown.sentenceRead,
          sentenceWriteEnabled: s.sentenceWrite,
          sentenceStagesForAllWords: shown.sentenceStagesForAllWords,
        }),
      ),
    [
      directions,
      s.questionsPerSession,
      shown.newWords,
      shown.sentenceRead,
      s.sentenceWrite,
      shown.sentenceStagesForAllWords,
    ],
  );

  return { s, set, disabled, shown, directions, time, env };
};

export type Proto = ReturnType<typeof useProtoSettings>;

export type Group = 'session' | 'answers' | 'focus' | 'stages' | 'sound' | 'account';

export const quizName = (v: string) => (v === 'input' ? pc.input : pc.flashcard);

/** The values of a group in one line, for a closed header or an index row. */
export const summary = (p: Proto, g: Group): string => {
  const { s, shown } = p;
  switch (g) {
    case 'session':
      return `${s.questionsPerSession} ${pc.questions.toLowerCase()} · ${p.time} · ${
        s.charSet === 'simp' ? pc.simp : pc.trad
      }`;
    case 'answers':
      return `${pc.meaning}: ${quizName(s.meaningQuizType)} · ${pc.pinyin}: ${quizName(
        s.pinyinQuizType,
      )}`;
    case 'focus': {
      if (s.priority === 'none') return pc.noFocus;
      const name = SKILLS.find((k) => k.key === s.priority)?.label ?? '';
      return s.onlyPriority ? `${name} only` : name;
    }
    case 'stages':
      return [
        shown.newWords && pc.newWords,
        pc.test,
        shown.sentenceRead && pc.sentenceRead,
        s.sentenceWrite && pc.sentenceWrite,
      ]
        .filter(Boolean)
        .join(' → ');
    case 'sound':
      return (
        [shown.useSound && pc.tts, s.useSoundEffects && pc.effects].filter(Boolean).join(' · ') ||
        pc.off
      );
    case 'account':
      return p.env.email ?? pc.notSignedIn;
  }
};

// ---- Controls. #407 asks the page and the session sheet to share these. ----

export const Switch: React.FC<{
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, disabled, onChange, label }) => (
  <ButtonBase
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    sx={{
      position: 'relative',
      flex: 'none',
      width: 40,
      height: 24,
      borderRadius: '12px',
      bgcolor: checked ? colors.primaryDark : colors.borderStrong,
      opacity: disabled ? 0.45 : 1,
      transition: 'background-color 150ms ease',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: 3,
        left: checked ? 19 : 3,
        width: 18,
        height: 18,
        borderRadius: '9px',
        bgcolor: colors.white,
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 150ms ease',
      }}
    />
  </ButtonBase>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{
        display: 'inline-flex',
        p: '3px',
        gap: '2px',
        bgcolor: colors.blankDay,
        border: `1px solid ${colors.divider}`,
        borderRadius: '8px',
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            sx={{
              height: size === 'sm' ? 30 : 36,
              px: size === 'sm' ? 1.25 : 1.75,
              borderRadius: '6px',
              fontFamily: fonts.body,
              fontSize: size === 'sm' ? 13 : 14,
              fontWeight: 600,
              bgcolor: on ? colors.card : 'transparent',
              color: o.disabled ? colors.disabledText : on ? colors.text : colors.textSecondary,
              boxShadow: on ? `0 1px 2px rgba(70,50,30,0.18)` : 'none',
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export const Stepper: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ value, min, max, step, onChange }) => {
  const btn = {
    width: 40,
    height: 40,
    borderRadius: '20px',
    border: `1px solid ${colors.borderStrong}`,
    fontSize: 22,
    lineHeight: 1,
    color: colors.primaryDark,
    '&.Mui-disabled': { color: colors.disabledText, borderColor: colors.divider },
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <ButtonBase
        aria-label={pc.fewer}
        disabled={value <= min}
        onClick={() => onChange(value - step)}
        sx={btn}
      >
        −
      </ButtonBase>
      <Box
        sx={{
          minWidth: 36,
          textAlign: 'center',
          fontSize: 22,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Box>
      <ButtonBase
        aria-label={pc.more}
        disabled={value >= max}
        onClick={() => onChange(value + step)}
        sx={btn}
      >
        +
      </ButtonBase>
    </Box>
  );
};

/** A small caps label above a group. */
export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      px: 0.5,
      mb: 1,
    }}
  >
    {children}
  </Box>
);

/** The quiz-type options, with the page's names. */
export const quizOptions: { value: QuizType; label: string }[] = [
  { value: 'input', label: pc.input },
  { value: 'flashcard', label: pc.flashcard },
];
