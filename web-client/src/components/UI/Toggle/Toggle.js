import React from "react";

import classes from "./Toggle.module.css";

const toggle = (props) => {
  return (
    <div className={classes.ToggleContainer}>
      <label>Auto Record:</label>
      <label className={classes.Toggle}>
        <input
          checked={props.checked}
          onChange={props.changed}
          type="checkbox"
        />
        <span className={classes.Slider}></span>
      </label>
    </div>
  );
};

export default toggle;
