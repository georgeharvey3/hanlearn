import React from 'react';
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

const TestSummary: React.FC<TestSummaryProps> = ({
  history,
  scores,
  continueAvailable,
  continueClicked,
}) => {
  const homePressed = (): void => {
    history.push('/');
  };

  const scoreRows = scores?.map((row, index) => {
    return <TableRow key={index}>{[row.char, row.score]}</TableRow>;
  });

  let continueButton: React.ReactNode = null;

  if (continueAvailable) {
    continueButton = (
      <Button
        clicked={continueClicked}
        style={{ width: '180px', height: 'auto', margin: '0 0 20px 0' }}
      >
        Continue To Sentence Stage
      </Button>
    );
  }

  return (
    <Aux>
      <button className={classes.HomeButton} onClick={homePressed}>
        <img alt="home" src={HomePic} />
      </button>
      <h3>Test Summary</h3>
      <Table headings={['Word', 'Score']}>{scoreRows}</Table>
      {continueButton}
    </Aux>
  );
};

export default withRouter(TestSummary);
