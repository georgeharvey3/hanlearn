import React from "react";

import classes from "./Spinner.module.css";

const spinner = (props) => (
  <div className={classes.Loader} style={props.style}>
    Loading...
  </div>
);

export default spinner;
