import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';

import Spinner from '../../components/UI/Spinner/Spinner';
import { RootState } from '../../types/store';
import { getSchedulerStats, SchedulerStats } from '../../services/statsService';
import { reportError } from '../../services/errorReporting';
import RetentionByTypeCard from './widgets/RetentionByTypeCard';
import MatureIntervalCard from './widgets/MatureIntervalCard';
import ReviewLoadCard from './widgets/ReviewLoadCard';

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  activeListId: state.addWords.activeListId,
});

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

/**
 * How the scheduler is doing, as opposed to how the learner is doing.
 *
 * It is a page of its own rather than a row of dashboard cards because the
 * dashboard's job is to get the learner into a session, and four diagnostic
 * panels in the way of that is the opposite of what it is for.
 */
const Stats: React.FC<PropsFromRedux> = ({ userId, activeListId }) => {
  const [stats, setStats] = useState<SchedulerStats | null>(null);
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
      // '__all__' is a virtual list; pass undefined so the stats cover every list
      const data = await getSchedulerStats(
        userId,
        activeListId === '__all__' ? undefined : activeListId,
      );
      setStats(data);
    } catch (err) {
      console.error('Failed to load scheduler stats:', err);
      reportError(err, { feature: 'scheduler-stats' });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, activeListId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const errorContent = (
    <Box sx={{ textAlign: 'center', py: 4 }} role="alert">
      <Typography sx={{ color: 'error.main', mb: 2 }}>Could not load your stats.</Typography>
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
      <Box>
        <Typography variant="h4" sx={{ textAlign: 'left', fontWeight: 'bold' }}>
          Stats
        </Typography>
        <Typography variant="body2" color="text.secondary">
          How well the schedule is fitting your memory.
        </Typography>
      </Box>

      {loading && <Spinner />}
      {!loading && error && errorContent}
      {!loading && !error && stats && (
        <>
          {stats.daysStudied === 0 && (
            <Typography variant="body2" color="text.secondary">
              Retention and promotion are counted from your sessions, so they start filling in from
              your next one. The intervals and the load ahead are ready now.
            </Typography>
          )}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MatureIntervalCard
                medianInterval={stats.medianMatureInterval}
                matureCount={stats.matureCount}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <RetentionByTypeCard metrics={stats.directions} windowDays={stats.windowDays} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <ReviewLoadCard load={stats.load} />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default connector(Stats);
