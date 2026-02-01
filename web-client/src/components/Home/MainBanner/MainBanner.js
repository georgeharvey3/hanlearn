import React from "react";

import classes from "./MainBanner.module.css";

import Aux from "../../../hoc/Aux";

const mainBanner = () => (
  <Aux>
    <div className={classes.MainBanner}>
      <div className={classes.Image}>
        <div>
          <h2>
            A vocabulary learning application made especially for Mandarin
          </h2>
          <p>
            With Chinese vocabulary, there is more to learn than in other
            languages
          </p>
          <br />
          <p>
            Make long-lasting connections between the written forms,
            pronunciations and meanings of Chinese words with HanLearn
          </p>
        </div>
      </div>
    </div>
  </Aux>
);

export default mainBanner;
