import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

import Spinner from '../../components/UI/Spinner/Spinner';
import ListSelector from '../../components/UI/ListSelector/ListSelector';
import { RootState } from '../../types/store';
import { DashboardStats, getDashboardStats } from '../../services/dashboardService';
import * as wordActions from '../../store/actions/index';
import WordsDueCard from './widgets/WordsDueCard';
import StreakCard from './widgets/StreakCard';
import MasteryCard from './widgets/MasteryCard';
import DirectionStrengthCard from './widgets/DirectionStrengthCard';
import WeeklyStatsCard from './widgets/WeeklyStatsCard';
import Chengyu from '../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import { reportError } from '../../services/errorReporting';

import { useHistory } from 'react-router-dom';
import PrototypeSwitcher, {
  usePrototypeParam,
  useStickyPrototypeParam,
} from '../../components/UI/PrototypeSwitcher/PrototypeSwitcher';
import { describeSavedSession, readSavedSession } from '../../utils/savedSession';
import { dayKey } from '../../utils/retention';
import {
  DashboardVariantProps,
  HistoryDay,
  emptyStats,
  prototypeStates,
  sampleForecast,
  sampleHistory,
  sampleStats,
} from './prototype/dashboardShared';
import VariantM, { name as nameM } from './prototype/VariantM';
import VariantN, { name as nameN } from './prototype/VariantN';
import VariantO, { name as nameO } from './prototype/VariantO';
import VariantP, { name as nameP } from './prototype/VariantP';
import { loadAhead, sampleWords } from './prototype/dashboardWords';
import { getReviewStats } from '../../services/retentionService';
import { lookbackFrom } from '../../utils/retention';
import { DIRECTIONS } from '../../types/models';

// PROTOTYPE (#403): `?variant=M|N|O|P` swaps the Dashboard's headline, and
// `?state=` forces a preview state. No variant param renders the current page.
// Every variant has the chosen widgets (chengyu, five skills, calendar) below
// its headline. Variants A to L are in this branch's history.
const dashboardVariants = [
  { key: '', name: 'Current' },
  { key: 'M', name: nameM },
  { key: 'N', name: nameN },
  { key: 'O', name: nameO },
  { key: 'P', name: nameP },
];

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
  listStats: state.addWords.listStats,
  words: state.addWords.words,
});

const mapDispatchToProps = {
  onInitWordLists: wordActions.initWordLists,
  onInitWords: wordActions.initWords,
  onSwitchList: wordActions.switchActiveList,
  onCreateList: wordActions.postCreateWordList,
  onRenameList: wordActions.postRenameWordList,
  onDeleteList: wordActions.postDeleteWordList,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const Dashboard: React.FC<PropsFromRedux> = ({
  userId,
  lists,
  activeListId,
  listStats,
  words,
  onInitWordLists,
  onInitWords,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      // '__all__' is a virtual list; pass undefined so stats cover every list
      const data = await getDashboardStats(
        userId,
        activeListId === '__all__' ? undefined : activeListId,
      );
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      reportError(err, { feature: 'dashboard-stats' });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, activeListId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (userId) {
      onInitWordLists();
    }
  }, [userId, onInitWordLists]);

  const history = useHistory();
  const variant = useStickyPrototypeParam('variant');
  const previewState = usePrototypeParam('state');

  // The variants count words for the forecast; the Dashboard does not load them.
  useEffect(() => {
    if (variant && userId) onInitWords();
  }, [variant, userId, activeListId, onInitWords]);

  const [reviewHistory, setReviewHistory] = useState<HistoryDay[]>([]);
  useEffect(() => {
    if (!variant || !userId) return;
    getReviewStats(userId, lookbackFrom(new Date(), 120))
      .then((days) =>
        setReviewHistory(
          days.map((d) => ({
            date: d.date,
            reviews: DIRECTIONS.reduce((s, dir) => s + d.directions[dir].attempts, 0),
            promoted: DIRECTIONS.reduce((s, dir) => s + d.directions[dir].promoted, 0),
            byDirection: DIRECTIONS.reduce(
              (acc, dir) => {
                acc[dir] = {
                  reviews: d.directions[dir].reviews,
                  passes: d.directions[dir].reviewPasses,
                };
                return acc;
              },
              {} as HistoryDay['byDirection'],
            ),
          })),
        ),
      )
      .catch(() => setReviewHistory([]));
  }, [variant, userId]);

  if (variant) {
    const saved = readSavedSession();
    const realResume =
      saved &&
      saved.userId === userId &&
      saved.date === dayKey(new Date()) &&
      saved.listId === activeListId
        ? describeSavedSession(saved)
        : null;
    // A signed-in account with no words still shows a full page in Normal.
    const shownStats =
      previewState === 'empty' ? emptyStats : stats && stats.totalWords > 0 ? stats : sampleStats;
    const props: DashboardVariantProps = {
      stats: shownStats,
      loading: previewState === 'loading' || (loading && !previewState),
      error: previewState === 'error' || (error && !previewState),
      words: previewState === 'empty' ? [] : words.length ? words : sampleWords,
      // An account with no history yet borrows a sample, so the variants can be judged.
      history:
        previewState === 'empty' ? [] : reviewHistory.length ? reviewHistory : sampleHistory(),
      forecast:
        previewState === 'empty'
          ? Array(14).fill(0)
          : words.length
            ? loadAhead(words, 14)
            : sampleForecast,
      charSet: localStorage.getItem('charSet') === 'simp' ? 'simp' : 'trad',
      resumeLabel:
        previewState === 'resume' ? '12 questions left' : previewState ? null : realResume,
      lists,
      activeListId,
      listStats,
      activeListName:
        activeListId === '__all__'
          ? 'All lists'
          : lists.find((l) => l.id === activeListId)?.name || 'General',
      onSwitchList,
      onStart: () => history.push('/test-words'),
      // Prototype: the Test page asks resume or start over itself.
      onResume: () => history.push('/test-words'),
      onStartOver: () => history.push('/test-words'),
      onAddWords: () => history.push('/add-words'),
      onRetry: loadStats,
    };
    return (
      <>
        {variant === 'M' && <VariantM {...props} />}
        {variant === 'N' && <VariantN {...props} />}
        {variant === 'O' && <VariantO {...props} />}
        {variant === 'P' && <VariantP {...props} />}
        <PrototypeSwitcher variants={dashboardVariants} states={prototypeStates} />
      </>
    );
  }

  const errorContent = (
    <Box sx={{ textAlign: 'center', py: 4 }} role="alert">
      <Typography sx={{ color: 'error.main', mb: 2 }}>Could not load dashboard data.</Typography>
      <Typography
        component="button"
        onClick={loadStats}
        sx={{
          color: 'primary.dark',
          background: 'none',
          border: 'none',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'inherit',
        }}
      >
        Try again
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ textAlign: 'left', fontWeight: 'bold' }}>
        Dashboard
      </Typography>
      <ListSelector
        lists={lists}
        activeListId={activeListId}
        listStats={listStats}
        onSwitchList={onSwitchList}
        onCreateList={onCreateList}
        onRenameList={onRenameList}
        onDeleteList={onDeleteList}
        readOnly
      />
      {loading && <Spinner />}
      {!loading && error && errorContent}
      {!loading && !error && (
        <>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <WordsDueCard
                dueWords={stats?.dueWords ?? 0}
                totalWords={stats?.totalWords ?? 0}
                estimatedStudyTime={stats?.estimatedStudyTime}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StreakCard streak={stats?.streak ?? 0} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <WeeklyStatsCard
                sessions={stats?.weeklyStats?.sessions ?? 0}
                wordsReviewed={stats?.weeklyStats?.wordsReviewed ?? 0}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MasteryCard
                masteredCount={stats?.masteredCount ?? 0}
                totalWords={stats?.totalWords ?? 0}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <DirectionStrengthCard
                distribution={stats?.directionDistribution ?? {}}
                totalWords={stats?.totalWords ?? 0}
              />
            </Grid>
          </Grid>
          <ErrorBoundary>
            <Chengyu />
          </ErrorBoundary>
        </>
      )}
      <PrototypeSwitcher variants={dashboardVariants} states={prototypeStates} />
    </Box>
  );
};

export default connector(Dashboard);
