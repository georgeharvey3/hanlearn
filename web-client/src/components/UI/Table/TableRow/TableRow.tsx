import React, { ReactNode } from 'react';
import MuiTableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Remove from './Remove/Remove';

interface TableRowProps {
  children?: ReactNode[];
  removable?: boolean;
  removed?: () => void;
}

const TableRow: React.FC<TableRowProps> = (props) => {
  const cells = props.children?.map((cell, index) => (
    <TableCell key={index} sx={{ color: 'inherit' }}>
      {cell}
    </TableCell>
  ));
  const remove = props.removable ? (
    <TableCell>
      <Remove clicked={props.removed} />
    </TableCell>
  ) : null;
  return (
    <MuiTableRow>
      {cells}
      {remove}
    </MuiTableRow>
  );
};

export default TableRow;
