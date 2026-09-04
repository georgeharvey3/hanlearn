import React, { Suspense, useCallback, useEffect } from 'react';
import { Route, Switch, withRouter, useLocation, RouteComponentProps } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { connect, ConnectedProps } from 'react-redux';

import Layout from './components/Layout/Layout';
import { RootState } from './types/store';
import AuthModal from './components/Auth/AuthModal';
import NotificationSnackbar from './components/NotificationSnackbar/NotificationSnackbar';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import * as actions from './store/actions/index';
import { trackPageView } from './services/analyticsService';
import { useVersionCheck } from './hooks/useVersionCheck';

const Home = React.lazy(() => import('./containers/Home/Home'));
const Dashboard = React.lazy(() => import('./containers/Dashboard/Dashboard'));
const Stats = React.lazy(() => import('./containers/Stats/Stats'));
const AddWords = React.lazy(() => import('./containers/AddWords/AddWords'));
const TestWords = React.lazy(() => import('./containers/TestWords/TestWords'));
const SettingsPage = React.lazy(() => import('./containers/SettingsPage/SettingsPage'));

const mapDispatchToProps = {
  onTryAutoLogin: actions.authCheckState,
  onSetSpeechAvailable: actions.setSpeechAvailable,
  onSetSynthAvailable: actions.setSynthAvailable,
  onSetVoice: actions.setVoice,
  onSetLang: actions.setLang,
};

const mapStateToProps = (state: RootState) => ({
  isAuthenticated: state.auth.userId !== null,
});

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & RouteComponentProps;

const App: React.FC<Props> = ({
  isAuthenticated,
  onTryAutoLogin,
  onSetSpeechAvailable,
  onSetSynthAvailable,
  onSetVoice,
  onSetLang,
}) => {
  const location = useLocation();

  // A deploy leaves a cached page on the old bundle until it is told. See
  // src/utils/appVersion.ts.
  useVersionCheck();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  const setSpeech = useCallback((): Promise<SpeechSynthesisVoice[]> => {
    return new Promise(function (resolve, reject) {
      const synth = window.speechSynthesis;
      let elapsed = 0;

      const id = setInterval(() => {
        elapsed += 10;
        if (synth.getVoices().length !== 0) {
          resolve(synth.getVoices());
          clearInterval(id);
        } else if (elapsed >= 5000) {
          clearInterval(id);
          reject(new Error('Speech synthesis voices not available'));
        }
      }, 10);
    });
  }, []);

  const loadVoices = useCallback((): void => {
    setSpeech()
      .then((voices) => {
        const chineseVoicezhCN = voices.filter((voice) => voice.lang.indexOf('zh-CN') === 0)[0];
        const chineseVoicezh = voices.filter((voice) => voice.lang.indexOf('zh') === 0)[0];
        if (chineseVoicezhCN || chineseVoicezh) {
          let voice: SpeechSynthesisVoice;
          let lang: string;

          if (chineseVoicezhCN) {
            voice = chineseVoicezhCN;
            lang = 'zh-CN';
          } else {
            voice = chineseVoicezh!;
            lang = 'zh';
          }

          onSetVoice(voice);
          onSetLang(lang);
          onSetSynthAvailable(true);
        } else {
          onSetSynthAvailable(false);
        }
      })
      .catch(() => {
        onSetSynthAvailable(false);
      });
  }, [onSetLang, onSetSynthAvailable, onSetVoice, setSpeech]);

  useEffect(() => {
    onTryAutoLogin();
    window.speechSynthesis.getVoices();

    try {
      const speechTest = new window.webkitSpeechRecognition();
      if (speechTest !== null) {
        onSetSpeechAvailable(true);
      } else {
        onSetSpeechAvailable(false);
      }
    } catch (err) {
      onSetSpeechAvailable(false);
    }

    let voicesHandler: (() => void) | null = null;

    try {
      const utterThis = new SpeechSynthesisUtterance('');
      if (utterThis !== null) {
        loadVoices();
        voicesHandler = () => {
          loadVoices();
        };
        window.speechSynthesis.addEventListener('voiceschanged', voicesHandler);
      } else {
        onSetSynthAvailable(false);
      }
    } catch (err) {
      onSetSynthAvailable(false);
    }

    return () => {
      if (voicesHandler) {
        window.speechSynthesis.removeEventListener('voiceschanged', voicesHandler);
      }
    };
  }, [loadVoices, onSetSpeechAvailable, onSetSynthAvailable, onTryAutoLogin]);

  return (
    <Box sx={{ textAlign: 'center', height: '100%' }}>
      <Layout>
        <ErrorBoundary>
          <Suspense
            fallback={
              <Box role="status" sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                <CircularProgress aria-label="Loading" />
              </Box>
            }
          >
            <Switch>
              <Route
                path="/"
                exact
                render={() => (
                  <ErrorBoundary>{isAuthenticated ? <Dashboard /> : <Home />}</ErrorBoundary>
                )}
              />
              <Route
                path="/add-words"
                render={() => (
                  <ErrorBoundary>
                    <AddWords />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/test-words"
                render={() => (
                  <ErrorBoundary>
                    <TestWords />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/stats"
                render={() => (
                  <ErrorBoundary>
                    <Stats />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/settings"
                render={() => (
                  <ErrorBoundary>
                    <SettingsPage />
                  </ErrorBoundary>
                )}
              />
              <Route
                path="/tryout"
                render={() => (
                  <ErrorBoundary>
                    <TestWords isDemo />
                  </ErrorBoundary>
                )}
              />
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </Layout>
      <AuthModal />
      <NotificationSnackbar />
    </Box>
  );
};

export default withRouter(connector(App));
