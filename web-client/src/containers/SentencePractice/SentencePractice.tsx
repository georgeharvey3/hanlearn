import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Redirect, useHistory } from 'react-router-dom';
import { Box, ButtonBase, Typography } from '@mui/material';

import { copy } from '../../copy';
import { colors, fonts } from '../../theme';
import StudyScreen from '../../components/Test/Study/StudyScreen';
import StudyTop from '../../components/Test/Study/StudyTop';
import { StudyButton } from '../../components/Test/Study/parts';
import ComprehendTask from '../../components/Sentences/ComprehendTask';
import ComposeTask from '../../components/Sentences/ComposeTask';
import { TaskLoading, TaskOutcome } from '../../components/Sentences/shared';
import { useFocusMode } from '../../components/Layout/focusMode';
import { routes } from '../../components/Navigation/navLinks';
import * as wordActions from '../../store/actions/index';
import { AppDispatch } from '../../types/actions';
import { RootState } from '../../types/store';
import { QueueData, loadQueueData } from '../../services/sentenceTabsService';
import { saveGrade } from '../../services/sentencePracticeService';
import { reportError } from '../../services/errorReporting';
import { SentenceTask, buildSet, recordPractice } from '../../utils/sentenceQueue';
import { SentenceTab, readSetSize } from '../../utils/sentenceSettings';

interface Props {
  tab: SentenceTab;
}

type Phase = 'loading' | 'error' | 'tasks' | 'done';

/**
 * The Comprehend tab or the Compose tab (#489): one visit is a set of tasks of
 * a fixed size, drawn from the queue of the tab. Each grade is saved when the
 * learner makes it, so a set needs no resume, and it never changes the schedule
 * of a word. See docs/adr/0021-sentence-tasks-are-a-separate-practice.md.
 */
const SentencePractice: React.FC<Props> = ({ tab }) => {
  const userId = useSelector((state: RootState) => state.auth.userId);
  const dispatch = useDispatch<AppDispatch>();
  const history = useHistory();

  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<QueueData | null>(null);
  const [set, setSet] = useState<SentenceTask[]>([]);
  const [position, setPosition] = useState(0);
  const [tally, setTally] = useState({ right: 0, wrong: 0 });

  const nextSet = useCallback(
    (queue: QueueData): SentenceTask[] =>
      buildSet({ ...queue, tab, size: readSetSize(tab), now: new Date() }),
    [tab],
  );

  const start = useCallback(
    (queue: QueueData) => {
      setSet(nextSet(queue));
      setPosition(0);
      setTally({ right: 0, wrong: 0 });
      setPhase('tasks');
    },
    [nextSet],
  );

  const load = useCallback(() => {
    if (!userId) return;
    setPhase('loading');
    loadQueueData(userId, [tab], new Date())
      .then((queue) => {
        setData(queue);
        start(queue);
      })
      .catch((error) => {
        reportError(error, { feature: 'sentence-queue', context: { tab } });
        setPhase('error');
      });
  }, [start, tab, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const empty = phase === 'tasks' && set.length === 0;
  useFocusMode(phase === 'tasks' && !empty);

  const advance = useCallback(() => {
    setPosition((prev) => {
      const next = prev + 1;
      if (next >= set.length) setPhase('done');
      return next;
    });
  }, [set.length]);

  // A word whose sentence does not load leaves the set.
  const onSkip = useCallback(() => advance(), [advance]);

  const onGrade = (outcome: TaskOutcome) => {
    const task = set[position];
    if (!task || !userId || !data) return;
    const at = new Date();
    saveGrade(userId, {
      wordId: task.word.id,
      sentenceId: task.sentenceId,
      tab,
      grade: outcome.result,
      mode: outcome.mode,
      ...(outcome.answer !== undefined ? { answer: outcome.answer } : {}),
      answerMs: outcome.answerMs,
      revealed: outcome.revealed,
      lookups: outcome.lookups,
      at,
    }).catch((error) => {
      reportError(error, { feature: 'sentence-save', context: { tab } });
      dispatch(wordActions.showNotification(copy.sentenceTabs.saveFailed, 'error'));
    });
    // The next set of this visit reads the grade at once, with no new query.
    setData({
      ...data,
      practice: recordPractice(data.practice, {
        wordId: task.word.id,
        tab,
        sentenceId: task.sentenceId,
        result: outcome.result,
        at,
      }),
    });
    setTally((prev) => ({ ...prev, [outcome.result]: prev[outcome.result] + 1 }));
    advance();
  };

  if (!userId) return <Redirect to={routes.home} />;

  const goHome = () => history.push(routes.home);
  const name = copy.sentenceTabs[tab];

  if (phase === 'loading') {
    return (
      <StudyScreen>
        <TaskLoading />
      </StudyScreen>
    );
  }

  if (phase === 'error') {
    return (
      <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 8, textAlign: 'center' }}>
        <Typography role="alert" sx={{ mb: 3, fontSize: 17, fontWeight: 600 }}>
          {copy.sentenceTabs.loadFailed}
        </Typography>
        <StudyButton variant="primary" onClick={load}>
          {copy.sentence.tryAgain}
        </StudyButton>
      </Box>
    );
  }

  if (empty) {
    return (
      <Box sx={{ width: '90%', maxWidth: 400, mx: 'auto', py: 8, textAlign: 'center' }}>
        <Typography variant="h6" component="h1" sx={{ mb: 3 }}>
          {copy.sentenceTabs.nothing}
        </Typography>
        <ButtonBase
          component={Link}
          to={routes.study}
          sx={{
            height: 48,
            px: 3,
            borderRadius: 1,
            bgcolor: colors.primaryDark,
            color: colors.white,
            fontFamily: fonts.body,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {copy.sentenceTabs.toStudy}
        </ButtonBase>
      </Box>
    );
  }

  if (phase === 'done') {
    const more = data ? nextSet(data).length > 0 : false;
    return (
      <StudyScreen>
        <StudyTop
          stage={copy.sentenceTabs.done}
          done={set.length}
          total={set.length}
          onEnd={goHome}
        />
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600 }}>
            {copy.sentenceTabs.tally(tally.right, tally.wrong)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {more && data && (
            <StudyButton onClick={() => start(data)}>{copy.sentenceTabs.practiseMore}</StudyButton>
          )}
          <StudyButton variant="primary" onClick={goHome}>
            {copy.summary.backToDashboard}
          </StudyButton>
        </Box>
      </StudyScreen>
    );
  }

  const task = set[position];
  const Task = tab === 'comprehend' ? ComprehendTask : ComposeTask;

  return (
    <StudyScreen>
      <StudyTop
        stage={name}
        done={position}
        position={position + 1}
        total={set.length}
        onEnd={goHome}
      />
      {task && (
        <Task
          key={`${position}-${task.word.id}-${task.sentenceId}`}
          word={task.word}
          sentenceId={task.sentenceId}
          onGrade={onGrade}
          onSkip={onSkip}
        />
      )}
    </StudyScreen>
  );
};

export default SentencePractice;
