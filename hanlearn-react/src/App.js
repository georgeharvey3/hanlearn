import React, { Component } from "react";
import { Route, Switch, withRouter } from "react-router-dom";
import "./App.css";
import { connect } from "react-redux";

import Layout from "./components/Layout/Layout";
import Home from "./containers/Home/Home";
import AddWords from "./containers/AddWords/AddWords";
import TestWords from "./containers/TestWords/TestWords";
import TestChengyus from "./containers/TestChengyus/TestChengyus";
import Auth from "./containers/Auth/Auth";
import Register from "./containers/Auth/Register";
import Logout from "./containers/Auth/Logout/Logout";
import SettingsPage from "./containers/SettingsPage/SettingsPage";
import * as actions from "./store/actions/index";

class App extends Component {
  constructor(props) {
    super(props);
    this.props.onTryAutoLogin();
    window.speechSynthesis.getVoices();

    try {
      let speechTest = new window.webkitSpeechRecognition();
      if (speechTest !== null) {
        this.props.onSetSpeechAvailable(true);
      } else {
        this.props.onSetSpeechAvailable(false);
      }
    } catch (err) {
      this.props.onSetSpeechAvailable(false);
    }

    try {
      let utterThis = new SpeechSynthesisUtterance("");
      if (utterThis !== null) {
        this.loadVoices();
        window.speechSynthesis.addEventListener("voiceschanged", () => {
          this.loadVoices();
        });
      } else {
        this.props.onSetSynthAvailable(false);
      }
    } catch (err) {
      this.props.onSetSynthAvailable(false);
    }
  }

  loadVoices() {
    this.setSpeech().then((voices) => {
      let chineseVoicezh;
      let chineseVoicezhCN;

      chineseVoicezhCN = voices.filter(
        (voice) => voice.lang.indexOf("zh-CN") === 0
      )[0];
      chineseVoicezh = voices.filter(
        (voice) => voice.lang.indexOf("zh") === 0
      )[0];
      if (chineseVoicezhCN || chineseVoicezh) {
        let voice;
        let lang;

        if (chineseVoicezhCN) {
          voice = chineseVoicezhCN;
          lang = "zh-CN";
        } else {
          voice = chineseVoicezh;
          lang = "zh";
        }

        this.props.onSetVoice(voice);
        this.props.onSetLang(lang);
        this.props.onSetSynthAvailable(true);
      } else {
        this.props.onSetSynthAvailable(false);
      }
    });
  }

  setSpeech() {
    return new Promise(function (resolve, reject) {
      let synth = window.speechSynthesis;
      let id;

      id = setInterval(() => {
        if (synth.getVoices().length !== 0) {
          resolve(synth.getVoices());
          clearInterval(id);
        }
      }, 10);
    });
  }

  render() {
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
            <Route path="/tryout" render={(props) => <TestWords isDemo />} />
          </Switch>
        </Layout>
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    onTryAutoLogin: () => dispatch(actions.authCheckState()),
    onSetSpeechAvailable: (available) =>
      dispatch(actions.setSpeechAvailable(available)),
    onSetSynthAvailable: (available) =>
      dispatch(actions.setSynthAvailable(available)),
    onSetVoice: (voice) => dispatch(actions.setVoice(voice)),
    onSetLang: (lang) => dispatch(actions.setLang(lang)),
  };
};

export default withRouter(connect(null, mapDispatchToProps)(App));
