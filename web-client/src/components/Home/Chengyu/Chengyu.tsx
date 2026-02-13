import React, { useEffect, useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

import { getDailyChengyu, convertDailyChengyu, lookupCharacterMeanings } from '../../../data/chengyus';

const Chengyu: React.FC = () => {
  const [finished, setFinished] = useState(false);
  const [incorrect, setIncorrect] = useState<number[]>([]);
  const [charMeanings, setCharMeanings] = useState<Map<string, string>>(new Map());
  const [charSet] = useState<'simp' | 'trad'>(
    (localStorage.getItem('charSet') as 'simp' | 'trad') || 'simp'
  );
  const [displayChengyu, setDisplayChengyu] = useState<string | null>(null);
  const [displayCharPinyins, setDisplayCharPinyins] = useState<
    { char: string; pinyin: string; meaning?: string }[] | null
  >(null);

  const dailyChengyu = useMemo(() => getDailyChengyu(), []);

  // Convert chengyu characters to the selected character set
  useEffect(() => {
    convertDailyChengyu(dailyChengyu, charSet).then((converted) => {
      setDisplayChengyu(converted.chengyu);
      setDisplayCharPinyins(converted.charPinyins);
    });
  }, [dailyChengyu, charSet]);

  const charPinyins = displayCharPinyins || dailyChengyu.charPinyins;

  useEffect(() => {
    if (finished) {
      // Look up character meanings when the chengyu is revealed
      const chars = charPinyins.map((c) => c.char);
      lookupCharacterMeanings(chars, charSet).then((results) => {
        const meanings = new Map<string, string>();
        results.forEach((result) => {
          meanings.set(result.char, result.meaning);
        });
        setCharMeanings(meanings);
      });
    }
  }, [finished, charPinyins, charSet]);

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
      <List sx={{ m: 0, p: 0 }}>
        {charPinyins.map((c, index) => {
          const meaning = charMeanings.get(c.char) || '';
          return (
            <React.Fragment key={index}>
              <Box
                component="li"
                sx={{
                  listStyle: 'none',
                  backgroundColor: 'transparent',
                  color: 'text.primary',
                  mb: 1,
                }}
              >
                <Typography sx={{ fontSize: '1.5em', m: '3px auto', fontWeight: 'normal' }}>
                  {c.char}
                </Typography>
                <Typography sx={{ fontSize: '0.9em', mb: '5px' }}>
                  ({c.pinyin})
                </Typography>
                {meaning && (
                  <Typography sx={{ fontSize: '0.85em', fontStyle: 'italic', opacity: 0.8 }}>
                    {meaning}
                  </Typography>
                )}
              </Box>
            </React.Fragment>
          );
        })}
        <Box
          component="li"
          sx={{
            listStyle: 'none',
            backgroundColor: 'transparent',
            color: 'text.primary',
            fontStyle: 'italic',
          }}
        >
          {dailyChengyu.correct}
        </Box>
      </List>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        width: '95%',
        height: 'auto',
        borderRadius: '10px',
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        p: '20px',
        boxSizing: 'border-box',
        color: 'text.primary',
        textAlign: 'center',
        fontSize: { xs: '1.1em', sm: '1.4em' },
      }}
    >
      <Typography variant="h5" sx={{ m: '5px 0' }}>Chengyu Of The Day</Typography>
      <Typography variant="h4" fontWeight="bold">{displayChengyu || dailyChengyu.chengyu}</Typography>
      <Typography variant="body1" sx={{ m: '5px 0', fontSize: { xs: '1.1em', sm: '1.3em' } }}>Choose the correct translation:</Typography>
      <List sx={{ p: 0, width: '100%', maxWidth: 600 }}>
        {dailyChengyu.options.map((op, index) => {
          const isCorrect = op === dailyChengyu.correct;
          const isIncorrect = incorrect.includes(index);
          const isHidden = finished && !isCorrect;

          return (
            <ListItemButton
              key={index}
              onClick={(event) => optionClicked(event, index)}
              sx={{
                listStyle: 'none',
                borderRadius: '5px',
                color: 'text.primary',
                opacity: isHidden ? 0 : 1,
                maxHeight: isHidden ? 0 : '50px',
                m: isHidden ? 0 : '5px',
                p: isHidden ? 0 : '15px',
                overflow: 'hidden',
                transition: 'opacity 0.25s ease-out, max-height 0.5s ease-out, margin 0.5s ease-out, padding 0.5s ease-out',
                justifyContent: 'center',
                backgroundColor: isIncorrect
                  ? 'error.main'
                  : finished && isCorrect
                    ? 'success.main'
                    : 'grey.400',
                '&:hover': {
                  backgroundColor: isIncorrect
                    ? 'error.main'
                    : finished && isCorrect
                      ? 'success.main'
                      : 'grey.500',
                  cursor: isHidden ? 'default' : 'pointer',
                },
              }}
              disabled={isHidden}
            >
              <ListItemText primary={op} sx={{ textAlign: 'center' }} />
            </ListItemButton>
          );
        })}
      </List>
      {details}
    </Paper>
  );
};

export default Chengyu;
