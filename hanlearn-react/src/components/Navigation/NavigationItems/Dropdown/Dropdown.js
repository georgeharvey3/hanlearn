import React, { Component } from 'react';

import Settings from '../../../Settings/Settings';

import classes from './Dropdown.module.css';

class Dropdown extends Component {
    constructor() {
        super();
        let localCharSet = localStorage.getItem("charSet");
        let localNumWords = localStorage.getItem("numWords");
        this.state = {
            charSet: localCharSet || 'simp',
            numWords: localNumWords || 5
        }
        this.onRadioChange = this.onRadioChange.bind(this);
    }

    onRadioChange = (e) => {
        this.setState({
            charSet: e.target.value
        });
    }

    onSliderChange = (e) => {
        this.setState({
            numWords: e.target.value
        });
    }

    componentWillUnmount = () => {
        localStorage.setItem("charSet", this.state.charSet);
        localStorage.setItem("numWords", this.state.numWords);
    }

    render () {
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