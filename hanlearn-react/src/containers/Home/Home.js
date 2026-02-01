import React, { Component } from "react";

import { connect } from "react-redux";

import Aux from "../../hoc/Aux";
import MainBanner from "../../components/Home/MainBanner/MainBanner";
import ExpBanner from "../../components/Home/ExpBanner/ExpBanner";
import SignUpBanner from "../../components/Home/SignUpBanner/SignUpBanner";
import AccountSummary from "../../components/Home/AccountSummary/AccountSummary";
import Footer from "../../components/Home/Footer/Footer";
import Chengyu from "../../components/Home/Chengyu/Chengyu";

import addCap from "../../assets/images/homepage/add.png";
import testCap from "../../assets/images/homepage/test.png";
import sentenceCap from "../../assets/images/homepage/sentence.png";

import * as actions from "../../store/actions/index";

class Home extends Component {
  state = {
    numDue: 0,
    numTot: 0,
  };

  componentDidMount = () => {
    if (this.props.isAuthenticated) {
      this.getDueWords();
      this.getUserWords();
      this.props.onInitWords(this.props.token);
    }
  };

  onClickSignUp = () => {
    this.props.history.push("/register");
  };

  onTryOutClicked = () => {
    this.props.history.push("/tryout");
  };

  onTestClicked = () => {
    this.props.history.push("/test-words");
  };

  getDueWords = () => {
    fetch("/api/get-due-user-words", {
      headers: {
        "x-access-token": this.props.token,
      },
    }).then((response) =>
      response
        .json()
        .then((data) => {
          this.setState({
            numDue: data.words.length,
          });
        })
        .catch((error) => {
          console.log("Could not fetch words: ", error);
        })
    );
  };

  getUserWords = () => {
    fetch("/api/get-user-words", {
      headers: {
        "x-access-token": this.props.token,
      },
    }).then((response) =>
      response
        .json()
        .then((data) => {
          this.setState({
            numTot: data.words.length,
          });
        })
        .catch((error) => {
          console.log("Could not fetch words: ", error);
        })
    );
  };

  render() {
    let firstBanner = (
      <SignUpBanner
        signUpClicked={this.onClickSignUp}
        tryOutClicked={this.onTryOutClicked}
      />
    );

    if (this.props.isAuthenticated) {
      firstBanner = (
        <AccountSummary
          numDue={this.state.numDue}
          numTot={this.state.numTot}
          testClicked={this.onTestClicked}
        />
      );
    }

    return (
      <Aux>
        <MainBanner />
        {firstBanner}
        <Chengyu />
        <ExpBanner
          priority="left"
          img={addCap}
          heading={"Build your word bank"}
        >
          Simply search for the Chinese word you want to add and we'll give you
          the pinyin pronunctiation and the meaning. Don't like the translation?
          Feel free to add your own!
        </ExpBanner>
        <ExpBanner priority="right" img={testCap} heading={"Start learning!"}>
          During the test, you will be asked to complete various pairwise
          combinations between the character(s), pinyin and meaning of each
          word. When you feel comfortable with a word you can eliminate it from
          your bank.
        </ExpBanner>
        <ExpBanner
          priority="left"
          img={sentenceCap}
          heading={"Create sentences"}
        >
          Once you have tested a word correctly, you can cement your
          understanding by using it in a sentence. Research shows this is one of
          the best ways to commit vocabulary to long term memory.
        </ExpBanner>
        <Footer />
      </Aux>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    isAuthenticated: state.auth.token !== null,
    token: state.auth.token,
    lang: state.settings.lang,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    onInitWords: (token) => dispatch(actions.initWords(token)),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Home);
