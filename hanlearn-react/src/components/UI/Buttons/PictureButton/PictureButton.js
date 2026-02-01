import React from "react";

import classes from "./PictureButton.module.css";

const PictureButton = (props) => {
  let attachedClasses = [classes.PictureButton, classes.Yellow];

  if (props.colour === "red") {
    attachedClasses = [classes.PictureButton, classes.Red];
  }

  if (props.colour === "grey") {
    attachedClasses = [classes.PictureButton, classes.Grey];
  }

  return (
    <button
      style={props.style}
      className={attachedClasses.join(" ")}
      onClick={props.clicked}
    >
      <img src={props.src} alt="sound" />
    </button>
  );
};

export default PictureButton;
