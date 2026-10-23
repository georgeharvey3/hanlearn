import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { useHistory } from 'react-router-dom';
import Box from '@mui/material/Box';

import { RootState } from '../../types/store';
import { DashboardStats, getDashboardStats } from '../../services/dashboardService';
import * as wordActions from '../../store/actions/index';
import ErrorBoundary from '../../components/ErrorBoundary/ErrorBoundary';
import { reportError } from '../../services/errorReporting';
import { copy } from '../../copy';
import {
  clearSavedSession,
  describeSavedSession,
  loadResumableSession,
} from '../../utils/savedSession';
import { SessionLaunch, SessionSize } from '../../utils/dashboard';
import TodayCard from './widgets/TodayCard';
import CalendarCard from './widgets/CalendarCard';
import ProgressCard from './widgets/ProgressCard';
import ChengyuCard from './widgets/ChengyuCard';
import SkillsCard from './widgets/SkillsCard';
import { Section } from './widgets/parts';

const text = copy.dashboard;

// Read by a screen reader, not shown: the Today card leads the page visually.
const visuallyHidden = {
  position: 'absolute',
  // Strings, because MUI reads the number 1 as 100%.
  width: '1px',
  height: '1px',
  margin: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

const mapStateToProps = (state: RootState) => ({
  userId: state.auth.userId,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
});

const mapDispatchToProps = {
  onInitWordLists: wordActions.initWordLists,
  onSwitchList: wordActions.switchActiveList,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

/**
 * The first screen after sign-in. Its first job is to start a session in as
 * few taps as possible; under that sit the chengyu, the five skills, the
 * calendar and the progress chart. No word of the learner's appears here: a
 * word seen just before the test asks it primes the answer.
 */
const Dashboard: React.FC<PropsFromRedux> = ({
  userId,
  lists,
  activeListId,
  onInitWordLists,
  onSwitchList,
}) => {
  const history = useHistory();
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

  // The unfinished session the Test page would offer. See
  // docs/adr/0014-resume-an-unfinished-session.md.
  const resumeLabel = useMemo(() => {
    if (!userId) return null;
    const saved = loadResumableSession(userId, activeListId);
    return saved ? describeSavedSession(saved) : null;
    // Read again whenever the stats reload, which is each visit and each list switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activeListId, stats]);

  const startSession = (launch: SessionLaunch) => history.push('/test-words', launch);

  const empty = !loading && !error && (stats?.totalWords ?? 0) === 0;
  const ready = !loading && !error;
  const historyDays = ready && !empty ? (stats?.history ?? []) : [];
  const forecast = ready && !empty ? (stats?.forecast ?? []) : [];

  return (
    <Box
      sx={{
        maxWidth: { xs: 560, md: 1100 },
        mx: 'auto',
        pb: 4,
        textAlign: 'left',
        display: 'grid',
        gap: { xs: 4, md: 3 },
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
        alignItems: 'start',
      }}
    >
      <Box component="h1" sx={visuallyHidden}>
        {text.title}
      </Box>
      {/* On a phone the two columns become one, in the order each `Slot` gives. */}
      <Column>
        <Slot order={0}>
          <TodayCard
            loading={loading}
            error={error}
            empty={empty}
            sessionSizes={stats?.sessionSizes ?? null}
            resumeLabel={resumeLabel}
            lists={lists}
            activeListId={activeListId}
            onSwitchList={onSwitchList}
            onStudy={(size: SessionSize) => startSession({ size })}
            onResume={() => startSession({ resume: true })}
            onStartOver={() => {
              clearSavedSession();
              startSession({});
            }}
            onAddWords={() => history.push('/add-words')}
            onRetry={loadStats}
          />
        </Slot>
        {!error && (
          <>
            <Slot order={4}>
              <Section title={text.sections.calendar}>
                <CalendarCard loading={loading} history={historyDays} forecast={forecast} />
              </Section>
            </Slot>
            <Slot order={3}>
              <Section title={text.sections.progress}>
                <ProgressCard loading={loading} empty={empty} history={historyDays} />
              </Section>
            </Slot>
          </>
        )}
      </Column>
      <Column>
        <Slot order={1}>
          <Section title={text.sections.chengyu}>
            <ErrorBoundary>
              <ChengyuCard loading={loading} />
            </ErrorBoundary>
          </Section>
        </Slot>
        {!error && (
          <Slot order={2}>
            <Section title={text.sections.skills}>
              <SkillsCard
                loading={loading}
                empty={empty}
                distribution={stats?.directionDistribution ?? null}
                history={historyDays}
              />
            </Section>
          </Slot>
        )}
      </Column>
    </Box>
  );
};

/** A desktop column. On a phone it steps aside and its slots join the one column. */
const Column: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: { xs: 'contents', md: 'flex' },
      flexDirection: 'column',
      gap: 4,
      minWidth: 0,
    }}
  >
    {children}
  </Box>
);

/** A widget's place: `order` on a phone, the column's own order on a desktop. */
const Slot: React.FC<{ order: number; children: React.ReactNode }> = ({ order, children }) => (
  <Box sx={{ order: { xs: order, md: 0 }, minWidth: 0 }}>{children}</Box>
);

export default connector(Dashboard);
