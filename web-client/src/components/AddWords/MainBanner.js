import React, { Component } from "react";

import classes from "./MainBanner.module.css";

import Input from "../UI/Input/Input";
import Button from "../UI/Buttons/Button/Button";
import Spinner from "../UI/Spinner/Spinner";

class MainBanner extends Component {
  state = {
    text: "Add words to your bank...",
  };

  componentDidMount = () => {
    document.addEventListener("keyup", this.onKeyUp);
  };

  componentWillUnmount = () => {
    document.removeEventListener("keyup", this.onKeyUp);
  };

  onFocusInput = () => {
    this.setState({ text: "Enter a Chinese word..." });
  };

  onBlurInput = () => {
    this.setState({ text: "Add words to your bank..." });
  };

  onKeyUp = (event) => {
    if (event.ctrlKey && event.key === "b") {
      document.getElementById("addInput").focus();
    }
  };

  render() {
    let button = (
      <Button
        disabled={this.props.submitDisabled}
        clicked={this.props.submitClicked}
      >
        Submit
      </Button>
    );

    if (this.props.loading) {
      button = <Spinner />;
    }

    return (
      <div className={classes.MainBanner}>
        <h2>{this.state.text}</h2>
        <form>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "400px",
              margin: "0 auto",
              height: "60px",
            }}
          >
            <Input
              id="addInput"
              value={this.props.newWord}
              changed={this.props.inputChanged}
              focussed={this.onFocusInput}
              blurred={this.onBlurInput}
            />
            <div style={{ display: "inline-block" }}>
              <div
                style={{
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "60px",
                  width: "100px",
                }}
              >
                {button}
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }
}

export default MainBanner;
