import React from 'react';

import classes from './ExpBanner.module.css';

const mainBanner = (props) => {
    let leftPanel;
    let rightPanel;
    if (props.priority === 'left') {
        leftPanel = <section>
                        <h3>{props.heading}</h3>
                        <p>{props.children}</p>
                    </section>
        rightPanel = <section className={classes.DesktopOnly}>
                        <img src={props.img} alt="ScreenCap"/>
                     </section>
    } else {
        leftPanel = <section className={classes.DesktopOnly}>
                        <img src={props.img} alt="ScreenCap"/>
                    </section>
        rightPanel = <section>
                         <h3>{props.heading}</h3>
                         <p>{props.children}</p>
                     </section>

    }
    return (
        <div className={classes.ExpBanner}>
            {leftPanel}
            {rightPanel}
        </div>   
    );
};

export default mainBanner;