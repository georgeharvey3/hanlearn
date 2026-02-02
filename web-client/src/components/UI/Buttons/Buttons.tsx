import React, { ReactNode } from 'react';

import classes from './Buttons.module.css';

import Button from './Button/Button';

interface ButtonsProps {
  children?: ReactNode[];
  clickedHandlers?: Array<() => void>;
}

const Buttons: React.FC<ButtonsProps> = (props) => {
  const buttonElems = props.children?.map((button, index) => (
    <Button key={index} clicked={props.clickedHandlers?.[index]}>
      {button}
    </Button>
  ));
  return <div className={classes.Buttons}>{buttonElems}</div>;
};

export default Buttons;
