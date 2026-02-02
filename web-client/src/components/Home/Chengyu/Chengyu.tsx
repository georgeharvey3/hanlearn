import React, { useEffect, useState } from 'react';

import classes from './Chengyu.module.css';

import Aux from '../../../hoc/Aux';

interface CharResult {
  char: string;
  trads: string[];
  pinyins: string[];
  meanings: string[];
}

const Chengyu: React.FC = () => {
  const [finished, setFinished] = useState(false);
  const [incorrect, setIncorrect] = useState<number[]>([]);
  const [chengyu, setChengyu] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [correct, setCorrect] = useState('');
  const [components, setComponents] = useState<CharResult[]>([]);

  useEffect(() => {
    fetch('/api/get-chengyu')
      .then((response) =>
        response
          .json()
          .then(
            (data: {
              chengyu: string;
              options: string[];
              correct: string;
              char_results: CharResult[];
            }) => {
              setChengyu(data.chengyu);
              setOptions(data.options);
              setCorrect(data.correct);
              setComponents(data.char_results);
            }
          )
          .catch((error) => {
            console.log(error);
          })
      )
      .catch((error) => {
        console.log(error);
      });
  }, []);

  const optionClicked = (_event: React.MouseEvent, index: number): void => {
    if (options[index] !== correct) {
      setIncorrect((prev) => prev.concat(index));
    } else {
      setFinished(true);
    }
  };

  let details: React.ReactNode = null;

  if (finished) {
    details = (
      <ul style={{ margin: '0px' }}>
        {components.map((c, index) => {
          let trad = '';
          const differentTrads: string[] = [];

          for (let i = 0; i < c.trads.length; i++) {
            if (c.trads[i] !== c.char) {
              differentTrads.push(c.trads[i]);
            }
          }

          if (differentTrads.length > 0) {
            trad = ' (' + differentTrads.join('/') + ')';
          }

          return (
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
                  {trad}
                </h5>{' '}
                ({c.pinyins.join('/')}): {c.meanings.join(', ')}
              </li>
              <br />
            </Aux>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={classes.Chengyu}>
      <h3>Chengyu Of The Day</h3>
      <h2>{chengyu}</h2>
      <p>Choose the correct translation:</p>
      <ul>
        {options.map((op, index) => {
          let classNames = [classes.show];

          if (finished) {
            if (op !== correct) {
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
