import React, { useCallback, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

import { RootState } from '../../types/store';
import { AppDispatch } from '../../types/actions';
import * as actions from '../../store/actions/index';
import { getCurrentUser } from '../../firebase/auth';
import { colors, fonts } from '../../theme';
import { copy } from '../../copy';
import {
  assumedNewWordCount,
  assumedWriteWordCount,
  estimateTestTime,
  formatTestTime,
  spreadOverDirections,
} from '../../utils/estimateTestTime';
import { eligibleDirections } from '../Test/Logic/TestLogic';
import {
  QUESTIONS_PER_SESSION_MAX,
  QUESTIONS_PER_SESSION_MIN,
  QUESTIONS_PER_SESSION_STEP,
  readQuestionsPerSession,
  writeQuestionsPerSession,
} from '../../utils/sessionSettings';
import { QuizCategory, QuizType, getQuizType, setQuizType } from '../../utils/audioSettings';
import { ChipGroup, FoldGroup, SegmentedRow, StepperRow, SwitchRow } from './controls';
import { autoRecordBlock, ttsBlock } from './rules';

type Priority = 'none' | 'MP' | 'PM' | 'MC' | 'CM';

type Group = 'session' | 'answers' | 'focus' | 'stages' | 'sound' | 'account';

// The settings that are a plain flag in localStorage, and their defaults.
const FLAGS = {
  useHandwriting: true,
  useSound: true,
  useSoundEffects: true,
  useAutoRecord: true,
  newWords: true,
  sentenceRead: true,
  sentenceWrite: true,
  sentenceStagesForAllWords: false,
  onlyPriority: false,
};

type Flag = keyof typeof FLAGS;

interface Values extends Record<Flag, boolean> {
  charSet: 'simp' | 'trad';
  questionsPerSession: number;
  meaningQuizType: QuizType;
  pinyinQuizType: QuizType;
  priority: Priority;
}

const readValues = (): Values => {
  const flags = {} as Record<Flag, boolean>;
  (Object.keys(FLAGS) as Flag[]).forEach((key) => {
    const stored = localStorage.getItem(key);
    flags[key] = stored === null ? FLAGS[key] : stored === 'true';
  });
  return {
    ...flags,
    charSet: localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad',
    questionsPerSession: readQuestionsPerSession(),
    meaningQuizType: getQuizType('meaning'),
    pinyinQuizType: getQuizType('pinyin'),
    priority: (localStorage.getItem('priority') as Priority) || 'none',
  };
};

const SKILLS: Exclude<Priority, 'none'>[] = ['MP', 'PM', 'MC', 'CM'];

const quizOptions: { value: QuizType; label: string }[] = [
  { value: 'input', label: copy.settings.input },
  { value: 'flashcard', label: copy.settings.flashcard },
];

const quizName = (type: QuizType) =>
  type === 'input' ? copy.settings.input : copy.settings.flashcard;

const mapStateToProps = (state: RootState) => ({
  speechAvailable: state.settings.speechAvailable,
  synthAvailable: state.settings.synthAvailable,
  signedIn: state.auth.userId !== null,
});

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  onLogout: () => dispatch(actions.logout()),
  onLogin: () => dispatch(actions.openAuthModal('login')),
});

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const Settings: React.FC<PropsFromRedux> = ({
  speechAvailable,
  synthAvailable,
  signedIn,
  onLogout,
  onLogin,
}) => {
  const [v, setValues] = useState<Values>(readValues);
  const [open, setOpen] = useState<Group[]>([]);

  const toggle = useCallback(
    (group: Group) => () =>
      setOpen((prev) =>
        prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
      ),
    [],
  );

  const setFlag = useCallback((key: Flag, value: boolean) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(key, String(value));
      // Writing needs handwriting, so a Writing focus ends with it.
      if (key === 'useHandwriting' && !value && prev.priority === 'CM') {
        next.priority = 'none';
        next.onlyPriority = false;
        localStorage.setItem('priority', 'none');
        localStorage.setItem('onlyPriority', 'false');
      }
      return next;
    });
  }, []);

  const setPriority = useCallback((priority: Priority) => {
    setValues((prev) => {
      const next = { ...prev, priority };
      localStorage.setItem('priority', priority);
      if (priority === 'none') {
        next.onlyPriority = false;
        localStorage.setItem('onlyPriority', 'false');
      }
      return next;
    });
  }, []);

  const setQuestions = useCallback((questionsPerSession: number) => {
    writeQuestionsPerSession(questionsPerSession);
    setValues((prev) => ({ ...prev, questionsPerSession }));
  }, []);

  const setCharSet = useCallback((charSet: Values['charSet']) => {
    localStorage.setItem('charSet', charSet);
    setValues((prev) => ({ ...prev, charSet }));
  }, []);

  const setQuiz = useCallback(
    (category: QuizCategory) => (type: QuizType) => {
      setQuizType(category, type);
      setValues((prev) => ({
        ...prev,
        [category === 'meaning' ? 'meaningQuizType' : 'pinyinQuizType']: type,
      }));
    },
    [],
  );

  const block = {
    useSound: ttsBlock(synthAvailable),
    useAutoRecord: autoRecordBlock(speechAvailable, v.meaningQuizType, v.pinyinQuizType),
    newWords: synthAvailable ? null : copy.settings.unsupported,
    sentenceRead: speechAvailable ? null : copy.settings.unsupported,
    sentenceStagesForAllWords: speechAvailable && v.sentenceRead ? null : copy.settings.needsRead,
  };

  // What a switch shows: a blocked switch reads as off.
  const shown = {
    useSound: v.useSound && !block.useSound,
    newWords: v.newWords && !block.newWords,
    sentenceRead: v.sentenceRead && !block.sentenceRead,
    sentenceStagesForAllWords: v.sentenceStagesForAllWords && !block.sentenceStagesForAllWords,
  };

  // The page has no word list, so it estimates an average session: the
  // budget of questions, spread over the directions the settings allow.
  const time = useMemo(
    () =>
      formatTestTime(
        estimateTestTime({
          directions: spreadOverDirections(
            v.questionsPerSession,
            eligibleDirections({
              includeHandwriting: v.useHandwriting,
              priority: v.priority,
              onlyPriority: v.onlyPriority,
            }),
          ),
          newWordCount: assumedNewWordCount(v.questionsPerSession),
          writeWordCount: assumedWriteWordCount(v.questionsPerSession),
          newWordsEnabled: shown.newWords,
          sentenceReadEnabled: shown.sentenceRead,
          sentenceWriteEnabled: v.sentenceWrite,
          sentenceStagesForAllWords: shown.sentenceStagesForAllWords,
        }),
      ),
    [
      v.questionsPerSession,
      v.useHandwriting,
      v.priority,
      v.onlyPriority,
      v.sentenceWrite,
      shown.newWords,
      shown.sentenceRead,
      shown.sentenceStagesForAllWords,
    ],
  );

  const email = signedIn ? (getCurrentUser()?.email ?? '') : '';
  const s = copy.settings;
  const charSetName = v.charSet === 'simp' ? s.simp : s.trad;

  const summary: Record<Group, string> = {
    session: s.sessionSummary(v.questionsPerSession, time, charSetName),
    answers: s.answersSummary(quizName(v.meaningQuizType), quizName(v.pinyinQuizType)),
    focus:
      v.priority === 'none'
        ? s.noFocus
        : v.onlyPriority
          ? s.onlySummary(s[v.priority])
          : s[v.priority],
    stages: [
      shown.newWords && s.newWords,
      s.test,
      shown.sentenceRead && s.sentenceRead,
      v.sentenceWrite && s.sentenceWrite,
    ]
      .filter(Boolean)
      .join(' → '),
    sound:
      [shown.useSound && s.useSound, v.useSoundEffects && s.useSoundEffects]
        .filter(Boolean)
        .join(' · ') || s.off,
    account: signedIn ? email : s.notSignedIn,
  };

  const group = (id: Group, children: React.ReactNode) => (
    <FoldGroup title={s[id]} summary={summary[id]} open={open.includes(id)} onToggle={toggle(id)}>
      {children}
    </FoldGroup>
  );

  const flagRow = (key: Flag, blocked: string | null = null, disabled = false) => (
    <SwitchRow
      label={s[key]}
      checked={v[key]}
      block={blocked}
      disabled={disabled}
      onChange={(value) => setFlag(key, value)}
    />
  );

  const accountRowSx = {
    minHeight: 64,
    px: 2,
    py: 1.25,
    borderTop: `1px solid ${colors.divider}`,
    display: 'flex',
    fontSize: 16,
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        textAlign: 'left',
        fontFamily: fonts.body,
        color: colors.text,
      }}
    >
      {group(
        'session',
        <>
          <StepperRow
            label={s.questionsPerSession}
            hint={s.about(time)}
            value={v.questionsPerSession}
            min={QUESTIONS_PER_SESSION_MIN}
            max={QUESTIONS_PER_SESSION_MAX}
            step={QUESTIONS_PER_SESSION_STEP}
            onChange={setQuestions}
          />
          <SegmentedRow
            label={s.characters}
            value={v.charSet}
            options={[
              { value: 'simp', label: s.simp },
              { value: 'trad', label: s.trad },
            ]}
            onChange={setCharSet}
          />
        </>,
      )}

      {group(
        'answers',
        <>
          <SegmentedRow
            label={s.meaning}
            value={v.meaningQuizType}
            options={quizOptions}
            onChange={setQuiz('meaning')}
          />
          <SegmentedRow
            label={s.pinyin}
            value={v.pinyinQuizType}
            options={quizOptions}
            onChange={setQuiz('pinyin')}
          />
          {flagRow('useHandwriting')}
          {flagRow('useAutoRecord', block.useAutoRecord)}
        </>,
      )}

      {group(
        'focus',
        <>
          <ChipGroup
            label={s.focus}
            value={v.priority}
            options={[
              { value: 'none' as Priority, label: s.noFocus },
              ...SKILLS.map((skill) => ({
                value: skill,
                label: s[skill],
                disabled: skill === 'CM' && !v.useHandwriting,
              })),
            ]}
            onChange={setPriority}
          />
          {flagRow('onlyPriority', null, v.priority === 'none')}
        </>,
      )}

      {group(
        'stages',
        <>
          {flagRow('newWords', block.newWords)}
          {flagRow('sentenceRead', block.sentenceRead)}
          {/* Widens the Read stage only. Make sentences keeps its own gate,
              because writing with a word the learner has only just met impedes
              learning it. See docs/adr/0011-gate-the-write-stage-on-partial-mastery.md. */}
          {flagRow('sentenceStagesForAllWords', block.sentenceStagesForAllWords)}
          {flagRow('sentenceWrite')}
        </>,
      )}

      {group(
        'sound',
        <>
          {flagRow('useSound', block.useSound)}
          {flagRow('useSoundEffects')}
        </>,
      )}

      {group(
        'account',
        signedIn ? (
          <>
            <Box
              sx={{
                ...accountRowSx,
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <Box component="span" sx={{ fontSize: 13, color: colors.textSecondary }}>
                {s.signedInAs}
              </Box>
              <span>{email}</span>
            </Box>
            <ButtonBase
              onClick={onLogout}
              sx={{
                width: '100%',
                height: 56,
                px: 2,
                justifyContent: 'flex-start',
                borderTop: `1px solid ${colors.divider}`,
                fontFamily: fonts.body,
                fontSize: 16,
                fontWeight: 600,
                color: colors.primaryLight,
              }}
            >
              {s.logout}
            </ButtonBase>
          </>
        ) : (
          <Box
            sx={{ ...accountRowSx, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <span>{s.notSignedIn}</span>
            <ButtonBase
              onClick={onLogin}
              sx={{
                height: 44,
                px: 2.5,
                borderRadius: 1,
                bgcolor: colors.primaryDark,
                color: colors.white,
                fontFamily: fonts.body,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {s.login}
            </ButtonBase>
          </Box>
        ),
      )}
    </Box>
  );
};

export default connector(Settings);
