import React, { ReactNode } from 'react';

import Remove from './Remove/Remove';

interface TableRowProps {
  children?: ReactNode[];
  removable?: boolean;
  removed?: () => void;
}

const TableRow: React.FC<TableRowProps> = (props) => {
  const cells = props.children?.map((cell, index) => <td key={index}>{cell}</td>);
  const remove = props.removable ? (
    <td>
      <Remove clicked={props.removed} />
    </td>
  ) : null;
  return (
    <tr>
      {cells}
      {remove}
    </tr>
  );
};

export default TableRow;
