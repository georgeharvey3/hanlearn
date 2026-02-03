import React, { useMemo, useState } from 'react';

import classes from './Chengyu.module.css';

import Aux from '../../../hoc/Aux';
import { getDailyChengyu } from '../../../data/chengyus';

const Chengyu: React.FC = () => {
  const [finished, setFinished] = useState(false);
  const [incorrect, setIncorrect] = useState<number[]>([]);

  const dailyChengyu = useMemo(() => getDailyChengyu(), []);

  const optionClicked = (_event: React.MouseEvent, index: number): void => {
    if (dailyChengyu.options[index] !== dailyChengyu.correct) {
      setIncorrect((prev) => prev.concat(index));
    } else {
      setFinished(true);
    }
  };

  let details: React.ReactNode = null;

  if (finished) {
    details = (
      <ul style={{ margin: '0px' }}>
        {dailyChengyu.charPinyins.map((c, index) => (
          <Aux key={index}>
            <li
              style={{
                maxHeight: '1000px',
                opacity: 1,
                backgroundColor: 'transparent',
                color: '#AA381E',
              }}
            >
              <h5
                style={{
                  fontSize: '1.5em',
                  margin: '3px auto',
                  fontWeight: 'normal',
                }}
              >
                {c.char}
              </h5>{' '}
              ({c.pinyin})
            </li>
            <br />
          </Aux>
        ))}
        <li
          style={{
            maxHeight: '1000px',
            opacity: 1,
            backgroundColor: 'transparent',
            color: '#AA381E',
            fontStyle: 'italic',
          }}
        >
          {dailyChengyu.correct}
        </li>
      </ul>
    );
  }

  return (
    <div className={classes.Chengyu}>
      <h3>Chengyu Of The Day</h3>
      <h2>{dailyChengyu.chengyu}</h2>
      <p>Choose the correct translation:</p>
      <ul>
        {dailyChengyu.options.map((op, index) => {
          let classNames = [classes.show];

          if (finished) {
            if (op !== dailyChengyu.correct) {
              classNames = [];
            } else {
              classNames = [classes.show, classes.Correct];
            }
          }

          if (incorrect.includes(index)) {
            classNames.push(classes.Incorrect);
          }

          return (
            <li
              className={classNames.join(' ')}
              key={index}
              onClick={(event) => optionClicked(event, index)}
            >
              {op}
            </li>
          );
        })}
      </ul>
      {details}
    </div>
  );
};

export default Chengyu;
