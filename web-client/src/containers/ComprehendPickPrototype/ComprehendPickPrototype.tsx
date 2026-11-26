/**
 * PROTOTYPE, throwaway. Not for main.
 *
 * Question: can a grade that the app sets replace the self-grade of the
 * Comprehend tab? Three variants on one dev-only route, switched by
 * `?variant=A|B|C`:
 *
 * - A "Pick at once": the options show with the sentence. Tap the English.
 * - B "Think, then pick": the options hide until "Show options".
 * - C "Match or not": one English shows. The learner says if it matches.
 *
 * The distractors are the English of the other sentences of the same word, so
 * every option holds the target word. The data is copied from
 * `public/sentences/` (5df2, 4e3a, 5e2e) so the route needs no build output.
 * Nothing is saved: the state panel at the foot shows what a grade would log.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Box, ButtonBase } from '@mui/material';

import StudyScreen, { StudyBody } from '../../components/Test/Study/StudyScreen';
import { PillToggle, PlayButton, StudyButton, StudyCard } from '../../components/Test/Study/parts';
import { colors, fonts } from '../../theme';

// Prototype copy. It stays here so the prototype is one file.
const text = {
  showOptions: 'Show options',
  showText: 'Show text',
  hideText: 'Hide text',
  next: 'Next',
  restart: 'Restart',
  matches: 'Matches',
  noMatch: 'No match',
  pickPrompt: 'What does it mean?',
  matchPrompt: 'Does this match?',
  right: 'Right',
  wrong: 'Wrong',
  audio: 'Audio',
  text: 'Text',
  done: 'Set done',
  state: 'State',
  variantNames: { A: 'Pick at once', B: 'Think, then pick', C: 'Match or not' } as Record<
    Variant,
    string
  >,
};

type Variant = 'A' | 'B' | 'C';
const VARIANTS: Variant[] = ['A', 'B', 'C'];

interface Sentence {
  id: string;
  simp: string;
  pinyin: string;
  english: string;
}
interface ProtoWord {
  simp: string;
  pinyin: string;
  meaning: string;
  sentences: Sentence[];
}

const WORDS: ProtoWord[] = [
  {
    simp: '已经',
    pinyin: 'yǐ jīng',
    meaning: 'already',
    sentences: [
      {
        id: 'a1',
        simp: '我已经做够了。',
        pinyin: 'wǒ yǐ jīng zuò gòu le',
        english: "I've done enough already.",
      },
      { id: 'a2', simp: '我已经起来了。', pinyin: 'wǒ yǐ jīng qǐ lái le', english: "I'm up." },
      {
        id: 'a3',
        simp: '他已经来了吗？',
        pinyin: 'tā yǐ jīng lái le ma',
        english: 'Has he come yet?',
      },
    ],
  },
  {
    simp: '为了',
    pinyin: 'wèi le',
    meaning: 'in order to; for the purpose of',
    sentences: [
      {
        id: 'b1',
        simp: '那是为了什么？',
        pinyin: 'nà shì wèi le shén me',
        english: 'What was it for?',
      },
      {
        id: 'b2',
        simp: '他们总是为了小事吵架。',
        pinyin: 'tā men zǒng shì wèi le xiǎo shì chǎo jià',
        english: 'They always fight over little things.',
      },
      {
        id: 'b3',
        simp: '这个公园是为了纪念他建的。',
        pinyin: 'zhè ge gōng yuán shì wèi le jì niàn tā jiàn de',
        english: 'This park was built in his memory.',
      },
    ],
  },
  {
    // Kept on purpose: two sentences differ only in 他 / 她, which sound the same.
    simp: '帮助',
    pinyin: 'bāng zhù',
    meaning: 'to help',
    sentences: [
      {
        id: 'c1',
        simp: '你应该帮助她。',
        pinyin: 'nǐ yīng gāi bāng zhù tā',
        english: 'You should help her.',
      },
      {
        id: 'c2',
        simp: '你应该帮助他。',
        pinyin: 'nǐ yīng gāi bāng zhù tā',
        english: 'You should help him.',
      },
      {
        id: 'c3',
        simp: '他们会帮助我们的。',
        pinyin: 'tā men huì bāng zhù wǒ men de',
        english: 'They will help us.',
      },
    ],
  },
];

// HSK 7-9 words, from public/sentences/ (6697, 9738, 7f62).
const HARD_WORDS: ProtoWord[] = [
  {
    simp: '暗中',
    pinyin: 'àn zhōng',
    meaning: 'secretly; in the dark',
    sentences: [
      {
        id: '9319cd8589',
        simp: '他一直在暗中帮助我。',
        pinyin: 'tā yī zhí zài àn zhōng bāng zhù wǒ',
        english: 'He has been helping me secretly all along.',
      },
      {
        id: 'a2934bf8a0',
        simp: '警察在暗中调查这件事。',
        pinyin: 'jǐng chá zài àn zhōng diào chá zhè jiàn shì',
        english: 'The police are quietly investigating this matter.',
      },
      {
        id: 'e3ffd7ad04',
        simp: '这两个人一直在暗中较劲。',
        pinyin: 'zhè liǎng gè rén yī zhí zài àn zhōng jiào jìn',
        english: 'Those two have been secretly competing with each other all along.',
      },
    ],
  },
  {
    simp: '霸占',
    pinyin: 'bà zhàn',
    meaning: 'to occupy by force; to hog',
    sentences: [
      {
        id: '2148c25c84',
        simp: '别霸占着电脑，我也要用。',
        pinyin: 'bié bà zhàn zhe diàn nǎo wǒ yě yào yòng',
        english: "Don't keep the computer to yourself; I need to use it too.",
      },
      {
        id: '3dcf159f3f',
        simp: '他一个人霸占了整张沙发。',
        pinyin: 'tā yī gè rén bà zhàn le zhěng zhāng shā fā',
        english: 'He hogged the whole sofa to himself.',
      },
      {
        id: '0971f9118e',
        simp: '那个地主霸占了农民的土地。',
        pinyin: 'nà gè dì zhǔ bà zhàn le nóng mín de tǔ dì',
        english: "That landlord seized the peasants' land.",
      },
    ],
  },
  {
    simp: '罢免',
    pinyin: 'bà miǎn',
    meaning: 'to remove from office',
    sentences: [
      {
        id: '58c2f7730e',
        simp: '他因为贪污被罢免了。',
        pinyin: 'tā yīn wèi tān wū bèi bà miǎn le',
        english: 'He was removed from his post for corruption.',
      },
      {
        id: '6f1d4ca521',
        simp: '董事会决定罢免总经理。',
        pinyin: 'dǒng shì huì jué dìng bà miǎn zǒng jīng lǐ',
        english: 'The board decided to remove the general manager.',
      },
      {
        id: '88bcf74583',
        simp: '有人要求罢免这名官员。',
        pinyin: 'yǒu rén yāo qiú bà miǎn zhè míng guān yuán',
        english: 'Some people are demanding that this official be dismissed.',
      },
    ],
  },
];

const now = () => Date.now();

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

interface Task {
  word: ProtoWord;
  target: Sentence;
  /** The options in screen order: the target and the other sentences of the word. */
  options: Sentence[];
  /** Variant C: the one English shown. The target half of the time. */
  probe: Sentence;
}

const makeTasks = (words: ProtoWord[]): Task[] =>
  words.map((word) => {
    const target = word.sentences[Math.floor(Math.random() * word.sentences.length)];
    const others = word.sentences.filter((s) => s !== target);
    return {
      word,
      target,
      options: shuffle(word.sentences),
      probe: Math.random() < 0.5 ? target : others[Math.floor(Math.random() * others.length)],
    };
  });

interface LogEntry {
  variant: Variant;
  word: string;
  sentenceId: string;
  mode: 'audio' | 'text';
  grade: 'right' | 'wrong';
  picked: string;
  textSeen: boolean;
  answerMs: number;
  optionsMs?: number;
}

const speakZh = (sentence: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(sentence);
  u.lang = 'zh-CN';
  window.speechSynthesis.speak(u);
};

const OptionButton: React.FC<{
  label: string;
  state: 'idle' | 'right' | 'wrong' | 'faded';
  disabled: boolean;
  onClick: () => void;
}> = ({ label, state, disabled, onClick }) => (
  <ButtonBase
    onClick={onClick}
    disabled={disabled}
    sx={{
      width: '100%',
      justifyContent: 'flex-start',
      textAlign: 'left',
      p: 1.75,
      borderRadius: 1,
      fontSize: 17,
      fontFamily: fonts.body,
      border: `1px solid ${
        state === 'right'
          ? colors.success
          : state === 'wrong'
            ? colors.primaryLight
            : colors.borderStrong
      }`,
      bgcolor:
        state === 'right'
          ? colors.successSurface
          : state === 'wrong'
            ? colors.errorSurface
            : colors.card,
      color: state === 'faded' ? colors.textSecondary : colors.text,
    }}
  >
    {label}
  </ButtonBase>
);

const TaskView: React.FC<{
  variant: Variant;
  task: Task;
  useSound: boolean;
  onLog: (entry: LogEntry) => void;
  onNext: () => void;
}> = ({ variant, task, useSound, onLog, onNext }) => {
  const [textShown, setTextShown] = useState(!useSound);
  const [optionsShown, setOptionsShown] = useState(variant !== 'B');
  const [picked, setPicked] = useState<Sentence | 'match' | 'nomatch' | null>(null);
  const textSeen = useRef(!useSound);
  const shownAt = useRef(0);
  const optionsAt = useRef(0);

  useEffect(() => {
    shownAt.current = now();
    if (useSound) speakZh(task.target.simp);
  }, [task, useSound]);

  const finished = picked !== null;
  const probeMatches = task.probe === task.target;

  const grade = (choice: Sentence | 'match' | 'nomatch') => {
    setPicked(choice);
    setTextShown(true);
    const right =
      choice === 'match'
        ? probeMatches
        : choice === 'nomatch'
          ? !probeMatches
          : choice === task.target;
    onLog({
      variant,
      word: task.word.simp,
      sentenceId: task.target.id,
      mode: useSound ? 'audio' : 'text',
      grade: right ? 'right' : 'wrong',
      picked: typeof choice === 'string' ? `${choice} (${task.probe.id})` : choice.id,
      textSeen: textSeen.current,
      answerMs: now() - shownAt.current,
      optionsMs: variant === 'B' ? optionsAt.current - shownAt.current : undefined,
    });
  };

  const optionState = (s: Sentence) => {
    if (!finished) return 'idle';
    if (s === task.target) return 'right';
    if (s === picked) return 'wrong';
    return 'faded';
  };

  return (
    <>
      <StudyBody>
        <StudyCard
          height={finished ? undefined : 220}
          sx={{ mt: 3, gap: 2, justifyContent: 'center' }}
        >
          {useSound && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <PlayButton
                size={textShown ? 44 : 88}
                loading={false}
                onClick={() => speakZh(task.target.simp)}
              />
            </Box>
          )}
          {textShown && (
            <Box
              component="p"
              lang="zh"
              sx={{ m: 0, fontFamily: fonts.hanzi, fontSize: 34, lineHeight: 1.6 }}
            >
              {task.target.simp}
            </Box>
          )}
          {finished && (
            <Box
              component="p"
              lang="zh-Latn"
              sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
            >
              {task.target.pinyin} · <b lang="zh">{task.word.simp}</b> {task.word.meaning}
            </Box>
          )}
          {useSound && !finished && (
            <PillToggle
              pressed={textShown}
              onClick={() => {
                textSeen.current = true;
                setTextShown((v) => !v);
              }}
            >
              {textShown ? text.hideText : text.showText}
            </PillToggle>
          )}
        </StudyCard>

        {variant !== 'C' && optionsShown && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, textAlign: 'left' }}>
              {text.pickPrompt}
            </Box>
            {task.options.map((s) => (
              <OptionButton
                key={s.id}
                label={s.english}
                state={optionState(s)}
                disabled={finished}
                onClick={() => grade(s)}
              />
            ))}
          </Box>
        )}

        {variant === 'C' && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, textAlign: 'left' }}>
              {text.matchPrompt}
            </Box>
            <OptionButton
              label={task.probe.english}
              state={finished ? (probeMatches ? 'right' : 'wrong') : 'idle'}
              disabled
              onClick={() => undefined}
            />
            {finished && !probeMatches && (
              <OptionButton
                label={task.target.english}
                state="right"
                disabled
                onClick={() => undefined}
              />
            )}
          </Box>
        )}

        {finished && (
          <Box
            sx={{
              mt: 2,
              fontWeight: 600,
              color: picked && isRight(task, picked) ? colors.success : colors.primaryLight,
            }}
          >
            {picked && isRight(task, picked) ? text.right : text.wrong}
          </Box>
        )}
      </StudyBody>

      {finished ? (
        <StudyButton variant="primary" onClick={onNext}>
          {text.next}
        </StudyButton>
      ) : variant === 'B' && !optionsShown ? (
        <StudyButton
          variant="primary"
          onClick={() => {
            optionsAt.current = now();
            setOptionsShown(true);
          }}
        >
          {text.showOptions}
        </StudyButton>
      ) : variant === 'C' ? (
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <StudyButton onClick={() => grade('nomatch')}>{text.noMatch}</StudyButton>
          <StudyButton variant="primary" onClick={() => grade('match')}>
            {text.matches}
          </StudyButton>
        </Box>
      ) : null}
    </>
  );
};

const isRight = (task: Task, choice: Sentence | 'match' | 'nomatch') =>
  choice === 'match'
    ? task.probe === task.target
    : choice === 'nomatch'
      ? task.probe !== task.target
      : choice === task.target;

const PrototypeSwitcher: React.FC<{ current: Variant; onChange: (v: Variant) => void }> = ({
  current,
  onChange,
}) => {
  const step = useCallback(
    (delta: number) => {
      const i = VARIANTS.indexOf(current);
      onChange(VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length]);
    },
    [current, onChange],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);
  if (!import.meta.env.DEV) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 999,
        bgcolor: '#111',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: 14,
      }}
    >
      <ButtonBase onClick={() => step(-1)} sx={{ px: 1, color: '#fff', fontSize: 18 }}>
        ‹
      </ButtonBase>
      <span>
        {current} ({text.variantNames[current]})
      </span>
      <ButtonBase onClick={() => step(1)} sx={{ px: 1, color: '#fff', fontSize: 18 }}>
        ›
      </ButtonBase>
    </Box>
  );
};

const ComprehendPickPrototype: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const raw = params.get('variant');
  const variant: Variant = raw === 'B' || raw === 'C' ? raw : 'A';

  // `?set=easy` gives the HSK 1-2 words, the default the HSK 7-9 words.
  const wordSet = params.get('set') === 'easy' ? WORDS : HARD_WORDS;
  const [useSound, setUseSound] = useState(true);
  const [tasks, setTasks] = useState<Task[]>(() => makeTasks(wordSet));
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);

  const restart = useCallback(() => {
    window.speechSynthesis?.cancel();
    setTasks(makeTasks(wordSet));
    setIndex(0);
  }, [wordSet]);

  const setVariant = useCallback(
    (v: Variant) => {
      const next = new URLSearchParams(location.search);
      next.set('variant', v);
      history.replace({ search: `?${next.toString()}` });
      restart();
    },
    [history, location.search, restart],
  );

  const task = tasks[index];
  const key = useMemo(
    () => `${variant}-${useSound}-${index}-${task?.target.id}`,
    [variant, useSound, index, task],
  );

  return (
    <StudyScreen>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <PillToggle pressed={useSound} onClick={() => setUseSound(true)}>
            {text.audio}
          </PillToggle>
          <PillToggle pressed={!useSound} onClick={() => setUseSound(false)}>
            {text.text}
          </PillToggle>
        </Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
          {Math.min(index + 1, tasks.length)} / {tasks.length}
        </Box>
      </Box>

      {task ? (
        <TaskView
          key={key}
          variant={variant}
          task={task}
          useSound={useSound}
          onLog={(entry) => setLog((prev) => [entry, ...prev])}
          onNext={() => setIndex((i) => i + 1)}
        />
      ) : (
        <>
          <StudyBody>
            <Box sx={{ mt: 6, fontSize: 20 }}>{text.done}</Box>
          </StudyBody>
          <StudyButton variant="primary" onClick={restart}>
            {text.restart}
          </StudyButton>
        </>
      )}

      <Box
        component="details"
        sx={{ mt: 2, mb: 10, textAlign: 'left', fontSize: 12, fontFamily: 'monospace' }}
      >
        <summary>
          {text.state} ({log.length})
        </summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(log, null, 2)}</pre>
      </Box>

      <PrototypeSwitcher current={variant} onChange={setVariant} />
    </StudyScreen>
  );
};

export default ComprehendPickPrototype;
