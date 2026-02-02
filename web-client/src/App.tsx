import React, { useCallback, useEffect } from 'react';
import { Route, Switch, withRouter, RouteComponentProps } from 'react-router-dom';
import './App.css';
import { connect, ConnectedProps } from 'react-redux';

import Layout from './components/Layout/Layout';
import Home from './containers/Home/Home';
import AddWords from './containers/AddWords/AddWords';
import TestWords from './containers/TestWords/TestWords';
import TestChengyus from './containers/TestChengyus/TestChengyus';
import Auth from './containers/Auth/Auth';
import Register from './containers/Auth/Register';
import Logout from './containers/Auth/Logout/Logout';
import SettingsPage from './containers/SettingsPage/SettingsPage';
import * as actions from './store/actions/index';

const mapDispatchToProps = {
  onTryAutoLogin: actions.authCheckState,
  onSetSpeechAvailable: actions.setSpeechAvailable,
  onSetSynthAvailable: actions.setSynthAvailable,
  onSetVoice: actions.setVoice,
  onSetLang: actions.setLang,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;
type Props = PropsFromRedux & RouteComponentProps;

const App: React.FC<Props> = ({
  onTryAutoLogin,
  onSetSpeechAvailable,
  onSetSynthAvailable,
  onSetVoice,
  onSetLang,
}) => {
  const setSpeech = useCallback((): Promise<SpeechSynthesisVoice[]> => {
    return new Promise(function (resolve) {
      const synth = window.speechSynthesis;
      let id: NodeJS.Timeout;

      id = setInterval(() => {
        if (synth.getVoices().length !== 0) {
          resolve(synth.getVoices());
          clearInterval(id);
        }
      }, 10);
    });
  }, []);

  const loadVoices = useCallback((): void => {
    setSpeech().then((voices) => {
      let chineseVoicezh: SpeechSynthesisVoice | undefined;
      let chineseVoicezhCN: SpeechSynthesisVoice | undefined;

      chineseVoicezhCN = voices.filter((voice) => voice.lang.indexOf('zh-CN') === 0)[0];
      chineseVoicezh = voices.filter((voice) => voice.lang.indexOf('zh') === 0)[0];
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
    <div className="App">
      <Layout>
        <Switch>
          <Route path="/" exact component={Home} />
          <Route path="/add-words" component={AddWords} />
          <Route path="/test-words" component={TestWords} />
          <Route path="/test-chengyus" component={TestChengyus} />
          <Route path="/auth" component={Auth} />
          <Route path="/register" component={Register} />
          <Route path="/logout" component={Logout} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/tryout" render={() => <TestWords isDemo />} />
        </Switch>
      </Layout>
    </div>
  );
};

export default withRouter(connector(App));
