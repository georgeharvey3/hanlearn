import React, { ReactNode } from 'react';

import classes from './Table.module.css';

interface TableProps {
  headings?: string[];
  children?: ReactNode;
}

const Table: React.FC<TableProps> = (props) => {
  const headings = props.headings?.map((heading) => {
    if (heading === 'Due Date (D/M/Y)') {
      return (
        <th className="Disappear" key={heading}>
          {heading}
        </th>
      );
    }
    return <th key={heading}>{heading}</th>;
  });
  return (
    <div className={classes.TableBox}>
      <table className={classes.Table}>
        <thead>
          <tr>{headings}</tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
};

export default Table;
