import React, { Component, ChangeEvent } from 'react';

import classes from './MainBanner.module.css';

import Input from '../UI/Input/Input';
import Button from '../UI/Buttons/Button/Button';
import Spinner from '../UI/Spinner/Spinner';

interface MainBannerProps {
  submitDisabled?: boolean;
  submitClicked?: () => void;
  loading?: boolean;
  newWord?: string;
  inputChanged?: (e: ChangeEvent<HTMLInputElement>) => void;
}

interface MainBannerState {
  text: string;
}

class MainBanner extends Component<MainBannerProps, MainBannerState> {
  state: MainBannerState = {
    text: 'Add words to your bank...',
  };

  componentDidMount = (): void => {
    document.addEventListener('keyup', this.onKeyUp);
  };

  componentWillUnmount = (): void => {
    document.removeEventListener('keyup', this.onKeyUp);
  };

  onFocusInput = (): void => {
    this.setState({ text: 'Enter a Chinese word...' });
  };

  onBlurInput = (): void => {
    this.setState({ text: 'Add words to your bank...' });
  };

  onKeyUp = (event: KeyboardEvent): void => {
    if (event.ctrlKey && event.key === 'b') {
      document.getElementById('addInput')?.focus();
    }
  };

  render(): React.ReactNode {
    let button: React.ReactNode = (
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
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '400px',
              margin: '0 auto',
              height: '60px',
            }}
          >
            <Input
              id="addInput"
              value={this.props.newWord}
              changed={this.props.inputChanged}
              focussed={this.onFocusInput}
              blurred={this.onBlurInput}
            />
            <div style={{ display: 'inline-block' }}>
              <div
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '60px',
                  width: '100px',
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
