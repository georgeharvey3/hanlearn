import React, { Component, ChangeEvent } from 'react';

import Settings from '../../../Settings/Settings';

import classes from './Dropdown.module.css';

interface DropdownState {
  charSet: string;
  numWords: number;
}

class Dropdown extends Component<{}, DropdownState> {
  constructor(props: {}) {
    super(props);
    const localCharSet = localStorage.getItem('charSet');
    const localNumWords = localStorage.getItem('numWords');
    this.state = {
      charSet: localCharSet || 'simp',
      numWords: localNumWords ? parseInt(localNumWords) : 5,
    };
    this.onRadioChange = this.onRadioChange.bind(this);
  }

  onRadioChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      charSet: e.target.value,
    });
  };

  onSliderChange = (e: ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      numWords: parseInt(e.target.value),
    });
  };

  componentWillUnmount = (): void => {
    localStorage.setItem('charSet', this.state.charSet);
    localStorage.setItem('numWords', this.state.numWords.toString());
  };

  render(): React.ReactNode {
    return (
      <div className={classes.Dropdown}>
        <button className={classes.Dropbtn}>Settings</button>
        <div className={classes.DropdownContent}>
          <Settings />
        </div>
      </div>
    );
  }
}

export default Dropdown;
