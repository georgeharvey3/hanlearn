import React, { useEffect, useMemo } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import Box from '@mui/material/Box';
import MainBanner from '../../components/Home/MainBanner/MainBanner';
import SignUpBanner from '../../components/Home/SignUpBanner/SignUpBanner';
import AccountSummary from '../../components/Home/AccountSummary/AccountSummary';
import Footer from '../../components/Home/Footer/Footer';
import Chengyu from '../../components/Home/Chengyu/Chengyu';
import HowItWorks from '../../components/Home/HowItWorks/HowItWorks';
import FeatureHighlights from '../../components/Home/FeatureHighlights/FeatureHighlights';

import PrototypeSwitcher, {
  useStickyPrototypeParam,
} from '../../components/UI/PrototypeSwitcher/PrototypeSwitcher';
import LandingVariantA, { name as nameA } from '../../components/Home/prototype/LandingVariantA';
import LandingVariantB, { name as nameB } from '../../components/Home/prototype/LandingVariantB';
import LandingVariantC, { name as nameC } from '../../components/Home/prototype/LandingVariantC';
import LandingVariantD, { name as nameD } from '../../components/Home/prototype/LandingVariantD';

import * as actions from '../../store/actions/index';
import { RootState } from '../../types/store';

const mapStateToProps = (state: RootState) => ({
  isAuthenticated: state.auth.userId !== null,
  userId: state.auth.userId,
  lang: state.settings.lang,
  words: state.addWords.words,
  wordsLoading: state.addWords.loading,
  lists: state.addWords.lists,
  activeListId: state.addWords.activeListId,
  listStats: state.addWords.listStats,
});

const mapDispatchToProps = {
  onInitWords: actions.initWords,
  onOpenAuthModal: actions.openAuthModal,
  onSwitchList: actions.switchActiveList,
  onCreateList: actions.postCreateWordList,
  onRenameList: actions.postRenameWordList,
  onDeleteList: actions.postDeleteWordList,
};

// PROTOTYPE (#402): `?variant=A|B|C|D` swaps the visitor's landing page.
// No param renders the current page.
const landingVariants = [
  { key: '', name: 'Current' },
  { key: 'A', name: nameA },
  { key: 'B', name: nameB },
  { key: 'C', name: nameC },
  { key: 'D', name: nameD },
];

const LandingVariant: React.FC<{ variant: string }> = ({ variant }) => {
  if (variant === 'A') return <LandingVariantA key="A" />;
  if (variant === 'B') return <LandingVariantB key="B" />;
  if (variant === 'C') return <LandingVariantC key="C" />;
  if (variant === 'D') return <LandingVariantD key="D" />;
  return null;
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & RouteComponentProps;

const Home: React.FC<Props> = ({
  isAuthenticated,
  userId,
  words,
  wordsLoading,
  lists,
  activeListId,
  listStats,
  onInitWords,
  onOpenAuthModal,
  onSwitchList,
  onCreateList,
  onRenameList,
  onDeleteList,
  history,
}) => {
  const variant = useStickyPrototypeParam('variant');
  const numTot = words.length;
  const numDue = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return words.filter((w) => {
      if (!w.due_date) return true;
      // Use the same safe parser as TestLogic to avoid Safari/iOS failures
      // with slash-separated date strings (YYYY/MM/DD)
      const normalised = w.due_date.replace(/\//g, '-');
      const [year, month, day] = normalised.split('-').map(Number);
      if (!year || !month || !day) return true;
      const due = new Date(year, month - 1, day);
      return due <= now;
    }).length;
  }, [words]);

  const activeListName = useMemo(
    () =>
      activeListId === '__all__'
        ? 'All Lists'
        : (lists || []).find((l) => l.id === activeListId)?.name || 'General',
    [lists, activeListId],
  );

  useEffect(() => {
    if (isAuthenticated && userId) {
      onInitWords();
    }
  }, [isAuthenticated, onInitWords, userId]);

  const onClickSignUp = (): void => {
    onOpenAuthModal('register');
  };

  const onTryOutClicked = (): void => {
    history.push('/tryout');
  };

  const onTestClicked = (): void => {
    history.push('/test-words');
  };

  const onAddWordsClicked = (): void => {
    history.push('/add-words');
  };

  if (!isAuthenticated && variant) {
    return (
      <>
        <LandingVariant variant={variant} />
        <PrototypeSwitcher variants={landingVariants} />
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <MainBanner
        signUpClicked={!isAuthenticated ? onClickSignUp : undefined}
        tryOutClicked={!isAuthenticated ? onTryOutClicked : undefined}
      />
      {isAuthenticated && (
        <AccountSummary
          numDue={numDue}
          numTot={numTot}
          testClicked={onTestClicked}
          addWordsClicked={onAddWordsClicked}
          loading={wordsLoading}
          activeListName={activeListName}
          lists={lists}
          activeListId={activeListId}
          listStats={listStats}
          onSwitchList={onSwitchList}
          onCreateList={onCreateList}
          onRenameList={onRenameList}
          onDeleteList={onDeleteList}
        />
      )}
      {isAuthenticated && (
        <Box sx={{ width: '95%', mx: 'auto' }}>
          <Chengyu />
        </Box>
      )}
      <HowItWorks />
      <FeatureHighlights />
      {!isAuthenticated && (
        <SignUpBanner signUpClicked={onClickSignUp} tryOutClicked={onTryOutClicked} />
      )}
      <Footer />
      {!isAuthenticated && <PrototypeSwitcher variants={landingVariants} />}
    </Box>
  );
};

export default withRouter(connector(Home));
