import React, { ReactNode } from 'react';

import classes from './ExpBanner.module.css';

interface ExpBannerProps {
  priority?: 'left' | 'right';
  heading?: string;
  img?: string;
  children?: ReactNode;
}

const ExpBanner: React.FC<ExpBannerProps> = (props) => {
  let leftPanel: ReactNode;
  let rightPanel: ReactNode;
  if (props.priority === 'left') {
    leftPanel = (
      <section>
        <h3>{props.heading}</h3>
        <p>{props.children}</p>
      </section>
    );
    rightPanel = (
      <section className={classes.DesktopOnly}>
        <img src={props.img} alt="ScreenCap" />
      </section>
    );
  } else {
    leftPanel = (
      <section className={classes.DesktopOnly}>
        <img src={props.img} alt="ScreenCap" />
      </section>
    );
    rightPanel = (
      <section>
        <h3>{props.heading}</h3>
        <p>{props.children}</p>
      </section>
    );
  }
  return (
    <div className={classes.ExpBanner}>
      {leftPanel}
      {rightPanel}
    </div>
  );
};

export default ExpBanner;
