import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';

import classes from './MainBanner.module.css';

import Input from '../UI/Input/Input';
import Button from '../UI/Buttons/Button/Button';
import Spinner from '../UI/Spinner/Spinner';

interface MainBannerProps {
  submitDisabled?: boolean;
  submitClicked?: (e: React.FormEvent) => void;
  loading?: boolean;
  newWord?: string;
  inputChanged?: (e: ChangeEvent<HTMLInputElement>) => void;
}

const MainBanner: React.FC<MainBannerProps> = ({
  submitDisabled,
  submitClicked,
  loading,
  newWord,
  inputChanged,
}) => {
  const [text, setText] = useState('Add words to your bank...');

  const onKeyUp = useCallback((event: KeyboardEvent): void => {
    if (event.ctrlKey && event.key === 'b') {
      document.getElementById('addInput')?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [onKeyUp]);

  const onFocusInput = (): void => {
    setText('Enter a Chinese word...');
  };

  const onBlurInput = (): void => {
    setText('Add words to your bank...');
  };

  let button: React.ReactNode = (
    <Button disabled={submitDisabled}>
      Submit
    </Button>
  );

  if (loading) {
    button = <Spinner />;
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (submitClicked) {
      submitClicked(e);
    }
  };

  return (
    <div className={classes.MainBanner}>
      <h2>{text}</h2>
      <form onSubmit={handleSubmit}>
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
            value={newWord}
            changed={inputChanged}
            focussed={onFocusInput}
            blurred={onBlurInput}
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
};

export default MainBanner;
