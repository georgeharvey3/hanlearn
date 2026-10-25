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
import { ChipGroup, FoldGroup, Trail, SegmentedRow, StepperRow, SwitchRow } from './controls';
import { autoRecordBlock, sentenceReadBlock, ttsBlock, newWordsBlock, quizOptions } from './rules';

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

const SKILLS: Exclude<Priority, 'none'>[] = ['MP', 'PM', 'MC', 'CM'];

const readPriority = (): Priority => {
  const stored = localStorage.getItem('priority');
  return SKILLS.find((skill) => skill === stored) ?? 'none';
};

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
    priority: readPriority(),
  };
};

/** The names that are switched on. */
const present = (...names: (string | false)[]): string[] =>
  names.filter((name): name is string => name !== false);

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
  const [values, setValues] = useState<Values>(readValues);
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
    useAutoRecord: autoRecordBlock(speechAvailable, values.meaningQuizType, values.pinyinQuizType),
    newWords: newWordsBlock(synthAvailable),
    sentenceRead: sentenceReadBlock(speechAvailable),
    sentenceStagesForAllWords:
      speechAvailable && values.sentenceRead ? null : copy.settings.needsRead,
  };

  // What a switch shows: a blocked switch reads as off.
  const shown = {
    useSound: values.useSound && !block.useSound,
    newWords: values.newWords && !block.newWords,
    sentenceRead: values.sentenceRead && !block.sentenceRead,
    sentenceStagesForAllWords: values.sentenceStagesForAllWords && !block.sentenceStagesForAllWords,
  };

  // The page has no word list, so it estimates an average session: the
  // budget of questions, spread over the directions the settings allow.
  const time = useMemo(
    () =>
      formatTestTime(
        estimateTestTime({
          directions: spreadOverDirections(
            values.questionsPerSession,
            eligibleDirections({
              includeHandwriting: values.useHandwriting,
              priority: values.priority,
              onlyPriority: values.onlyPriority,
            }),
          ),
          newWordCount: assumedNewWordCount(values.questionsPerSession),
          writeWordCount: assumedWriteWordCount(values.questionsPerSession),
          newWordsEnabled: shown.newWords,
          sentenceReadEnabled: shown.sentenceRead,
          sentenceWriteEnabled: values.sentenceWrite,
          sentenceStagesForAllWords: shown.sentenceStagesForAllWords,
        }),
      ),
    [
      values.questionsPerSession,
      values.useHandwriting,
      values.priority,
      values.onlyPriority,
      values.sentenceWrite,
      shown.newWords,
      shown.sentenceRead,
      shown.sentenceStagesForAllWords,
    ],
  );

  const email = signedIn ? (getCurrentUser()?.email ?? '') : '';
  const text = copy.settings;
  const charSetName = values.charSet === 'simp' ? text.simp : text.trad;

  const summary: Record<Group, React.ReactNode> = {
    session: text.sessionSummary(values.questionsPerSession, time, charSetName),
    answers: text.answersSummary(quizName(values.meaningQuizType), quizName(values.pinyinQuizType)),
    focus:
      values.priority === 'none'
        ? text.noFocus
        : values.onlyPriority
          ? text.onlySummary(text[values.priority])
          : text[values.priority],
    stages: (
      <Trail
        names={present(
          shown.newWords && text.newWords,
          text.test,
          shown.sentenceRead && text.sentenceRead,
          values.sentenceWrite && text.sentenceWrite,
        )}
      />
    ),
    sound: text.soundSummary(
      present(shown.useSound && text.useSound, values.useSoundEffects && text.useSoundEffects),
    ),
    account: signedIn ? email : text.notSignedIn,
  };

  const group = (id: Group, children: React.ReactNode) => (
    <FoldGroup
      title={text[id]}
      summary={summary[id]}
      open={open.includes(id)}
      onToggle={toggle(id)}
    >
      {children}
    </FoldGroup>
  );

  const flagRow = (key: Flag, blocked: string | null = null, disabled = false) => (
    <SwitchRow
      label={text[key]}
      checked={values[key]}
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
            label={text.questionsPerSession}
            hint={text.about(time)}
            value={values.questionsPerSession}
            min={QUESTIONS_PER_SESSION_MIN}
            max={QUESTIONS_PER_SESSION_MAX}
            step={QUESTIONS_PER_SESSION_STEP}
            onChange={setQuestions}
          />
          <SegmentedRow
            label={text.characters}
            value={values.charSet}
            options={[
              { value: 'simp', label: text.simp },
              { value: 'trad', label: text.trad },
            ]}
            onChange={setCharSet}
          />
        </>,
      )}

      {group(
        'answers',
        <>
          <SegmentedRow
            label={text.meaning}
            value={values.meaningQuizType}
            options={quizOptions}
            onChange={setQuiz('meaning')}
          />
          <SegmentedRow
            label={text.pinyin}
            value={values.pinyinQuizType}
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
            label={text.focus}
            value={values.priority}
            options={[
              { value: 'none' as Priority, label: text.noFocus },
              ...SKILLS.map((skill) => ({
                value: skill,
                label: text[skill],
                disabled: skill === 'CM' && !values.useHandwriting,
              })),
            ]}
            onChange={setPriority}
          />
          {flagRow('onlyPriority', null, values.priority === 'none')}
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
                {text.signedInAs}
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
              {text.logout}
            </ButtonBase>
          </>
        ) : (
          <Box
            sx={{ ...accountRowSx, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
          >
            <span>{text.notSignedIn}</span>
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
              {text.login}
            </ButtonBase>
          </Box>
        ),
      )}
    </Box>
  );
};

export default connector(Settings);
