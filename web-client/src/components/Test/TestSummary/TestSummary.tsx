import React, { Component } from 'react';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import Aux from '../../../hoc/Aux';
import Table from '../../UI/Table/Table';
import TableRow from '../../UI/Table/TableRow/TableRow';
import Button from '../../UI/Buttons/Button/Button';
import HomePic from '../../../assets/images/home.png';

import classes from './TestSummary.module.css';
import { WordScore } from '../../../types/models';

interface TestSummaryProps extends RouteComponentProps {
  scores?: WordScore[];
  continueAvailable?: boolean;
  continueClicked?: () => void;
}

class TestSummary extends Component<TestSummaryProps> {
  addWordsPressed = (): void => {
    this.props.history.push('/add-words');
  };

  testAgainPressed = (): void => {
    window.location.reload();
  };

  homePressed = (): void => {
    this.props.history.push('/');
  };

  render(): React.ReactNode {
    const scoreRows = this.props.scores?.map((row, index) => {
      return <TableRow key={index}>{[row.char, row.score]}</TableRow>;
    });

    let continueButton: React.ReactNode = null;

    if (this.props.continueAvailable) {
      continueButton = (
        <Button
          clicked={this.props.continueClicked}
          style={{ width: '180px', height: 'auto', margin: '0 0 20px 0' }}
        >
          Continue To Sentence Stage
        </Button>
      );
    }

    return (
      <Aux>
        <button className={classes.HomeButton} onClick={this.homePressed}>
          <img alt="home" src={HomePic} />
        </button>
        <h3>Test Summary</h3>
        <Table headings={['Word', 'Score']}>{scoreRows}</Table>
        {continueButton}
      </Aux>
    );
  }
}

export default withRouter(TestSummary);
