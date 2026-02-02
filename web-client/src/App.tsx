import React, { Component } from 'react';
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

class App extends Component<Props> {
  constructor(props: Props) {
    super(props);
    this.props.onTryAutoLogin();
    window.speechSynthesis.getVoices();

    try {
      const speechTest = new window.webkitSpeechRecognition();
      if (speechTest !== null) {
        this.props.onSetSpeechAvailable(true);
      } else {
        this.props.onSetSpeechAvailable(false);
      }
    } catch (err) {
      this.props.onSetSpeechAvailable(false);
    }

    try {
      const utterThis = new SpeechSynthesisUtterance('');
      if (utterThis !== null) {
        this.loadVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.loadVoices();
        });
      } else {
        this.props.onSetSynthAvailable(false);
      }
    } catch (err) {
      this.props.onSetSynthAvailable(false);
    }
  }

  loadVoices(): void {
    this.setSpeech().then((voices) => {
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

        this.props.onSetVoice(voice);
        this.props.onSetLang(lang);
        this.props.onSetSynthAvailable(true);
      } else {
        this.props.onSetSynthAvailable(false);
      }
    });
  }

  setSpeech(): Promise<SpeechSynthesisVoice[]> {
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
  }

  render(): React.ReactNode {
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
  }
}

export default withRouter(connector(App));
