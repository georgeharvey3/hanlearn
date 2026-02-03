import React, { useCallback, useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import Aux from '../../hoc/Aux';
import MainBanner from '../../components/Home/MainBanner/MainBanner';
import ExpBanner from '../../components/Home/ExpBanner/ExpBanner';
import SignUpBanner from '../../components/Home/SignUpBanner/SignUpBanner';
import AccountSummary from '../../components/Home/AccountSummary/AccountSummary';
import Footer from '../../components/Home/Footer/Footer';
import Chengyu from '../../components/Home/Chengyu/Chengyu';

import addCap from '../../assets/images/homepage/add.png';
import testCap from '../../assets/images/homepage/test.png';
import sentenceCap from '../../assets/images/homepage/sentence.png';

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
};

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & RouteComponentProps;

const Home: React.FC<Props> = ({
  isAuthenticated,
  userId,
  onInitWords,
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
    history.push('/register');
  };

  const onTryOutClicked = (): void => {
    history.push('/tryout');
  };

  const onTestClicked = (): void => {
    history.push('/test-words');
  };

  let firstBanner: React.ReactNode = (
    <SignUpBanner signUpClicked={onClickSignUp} tryOutClicked={onTryOutClicked} />
  );

  if (isAuthenticated) {
    firstBanner = (
      <AccountSummary
        numDue={numDue}
        numTot={numTot}
        testClicked={onTestClicked}
      />
    );
  }

  return (
    <Aux>
      <MainBanner />
      {firstBanner}
      <Chengyu />
      <ExpBanner priority="left" img={addCap} heading={'Build your word bank'}>
        Simply search for the Chinese word you want to add and we'll give you the pinyin
        pronunctiation and the meaning. Don't like the translation? Feel free to add your own!
      </ExpBanner>
      <ExpBanner priority="right" img={testCap} heading={'Start learning!'}>
        During the test, you will be asked to complete various pairwise combinations between the
        character(s), pinyin and meaning of each word. When you feel comfortable with a word you
        can eliminate it from your bank.
      </ExpBanner>
      <ExpBanner priority="left" img={sentenceCap} heading={'Create sentences'}>
        Once you have tested a word correctly, you can cement your understanding by using it in a
        sentence. Research shows this is one of the best ways to commit vocabulary to long term
        memory.
      </ExpBanner>
      <Footer />
    </Aux>
  );
};

export default withRouter(connector(Home));
