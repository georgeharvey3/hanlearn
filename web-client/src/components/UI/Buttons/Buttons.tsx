import React, { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
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
  return (
    <Stack direction="row" justifyContent="center" alignItems="center" sx={{ py: 3 }} flexWrap="wrap">
      {buttonElems}
    </Stack>
  );
};

export default Buttons;
