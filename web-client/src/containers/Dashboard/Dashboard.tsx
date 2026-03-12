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
import BankDistributionCard from './widgets/BankDistributionCard';
import MasteryCard from './widgets/MasteryCard';
import Chengyu from '../../components/Home/Chengyu/Chengyu';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
  listStats: state.addWords.listStats,
});

const mapDispatchToProps = {
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
    setError(false);
    try {
      const data = await getDashboardStats(userId, activeListId);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, activeListId]);

  const retryLoadStats = useCallback(() => {
    setLoading(true);
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography sx={{ color: 'error.main', mb: 2 }}>Could not load dashboard data.</Typography>
        <Typography
          component="button"
          onClick={retryLoadStats}
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
  }

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
          <BankDistributionCard distribution={stats?.bankDistribution ?? {}} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MasteryCard
            masteredCount={stats?.masteredCount ?? 0}
            totalWords={stats?.totalWords ?? 0}
          />
        </Grid>
      </Grid>
      <ErrorBoundary>
        <Chengyu />
      </ErrorBoundary>
    </Box>
  );
};

export default connector(Dashboard);
