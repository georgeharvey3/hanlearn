import React, { useCallback, useEffect, useState } from 'react';
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
import * as wordService from '../../services/wordService';

const mapStateToProps = (state: RootState) => ({
  isAuthenticated: state.auth.userId !== null,
  userId: state.auth.userId,
  lang: state.settings.lang,
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
  onInitWords,
  onOpenAuthModal,
  history,
}) => {
  const [numDue, setNumDue] = useState(0);
  const [numTot, setNumTot] = useState(0);

  const getDueWords = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const dueWords = await wordService.getDueUserWords(userId);
      setNumDue(dueWords.length);
    } catch (error) {
      console.error('Failed to get due words:', error);
    }
  }, [userId]);

  const getUserWords = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const words = await wordService.getUserWords(userId);
      setNumTot(words.length);
    } catch (error) {
      console.error('Failed to get user words:', error);
    }
  }, [userId]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      getDueWords();
      getUserWords();
      onInitWords();
    }
  }, [getDueWords, getUserWords, isAuthenticated, onInitWords, userId]);

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
        <AccountSummary numDue={numDue} numTot={numTot} testClicked={onTestClicked} />
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
