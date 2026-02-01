import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';

import Aux from '../../../hoc/Aux';
import Table from '../../UI/Table/Table';
import TableRow from '../../UI/Table/TableRow/TableRow';
import Button from '../../UI/Buttons/Button/Button';
import HomePic from '../../../assets/images/home.png';

import classes from './TestSummary.module.css';

class TestSummary extends Component {

    addWordsPressed = () => {
        this.props.history.push('/add-words');
    }

    testAgainPressed = () => {
        window.location.reload();
    }

    homePressed = () => {
        this.props.history.push('/');
    }

    render () {
        let scoreRows = this.props.scores.map((row, index) => {
            return (
                <TableRow key={index}>{[row.char, row.score]}</TableRow>
            );
        });

        let continueButton = null;

        if (this.props.continueAvailable) {
            continueButton = <Button clicked={this.props.continueClicked} style={{width: '180px', height: 'auto', margin: '0 0 20px 0'}}>Continue To Sentence Stage</Button>;
        }

        return (
            <Aux>
                <button className={classes.HomeButton} onClick={this.homePressed}>
                    <img alt="home" src={HomePic}/>
                </button>
                <h3>Test Summary</h3>
                <Table headings={['Word', 'Score']}>
                    {scoreRows}
                </Table>
                {continueButton}
            </Aux>
        );
    }
}

export default withRouter(TestSummary);