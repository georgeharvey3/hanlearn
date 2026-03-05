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

import * as actions from '../../store/actions/index';
import { RootState } from '../../types/store';

const mapStateToProps = (state: RootState) => ({
  isAuthenticated: state.auth.userId !== null,
  userId: state.auth.userId,
  lang: state.settings.lang,
  words: state.addWords.words,
  wordsLoading: state.addWords.loading,
});

const mapDispatchToProps = {
  onInitWords: actions.initWords,
  onOpenAuthModal: actions.openAuthModal,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & RouteComponentProps;

const Home: React.FC<Props> = ({
  isAuthenticated,
  userId,
  words,
  wordsLoading,
  onInitWords,
  onOpenAuthModal,
  history,
}) => {
  const numTot = words.length;
  const numDue = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return words.filter((w) => {
      if (!w.due_date) return true;
      const due = new Date(w.due_date);
      due.setHours(0, 0, 0, 0);
      return due <= now;
    }).length;
  }, [words]);

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
          loading={wordsLoading}
        />
      )}
      {isAuthenticated && <Chengyu />}
      <HowItWorks />
      <FeatureHighlights />
      {!isAuthenticated && (
        <SignUpBanner signUpClicked={onClickSignUp} tryOutClicked={onTryOutClicked} />
      )}
      <Footer />
    </Box>
  );
};

export default withRouter(connector(Home));
