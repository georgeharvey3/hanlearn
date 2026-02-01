import React from "react";

import Remove from "./Remove/Remove";

const tableRow = (props) => {
  let cells = props.children.map((cell, index) => <td key={index}>{cell}</td>);
  let remove = props.removable ? (
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

export default tableRow;
