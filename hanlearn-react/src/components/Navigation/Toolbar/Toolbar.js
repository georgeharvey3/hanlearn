import React from 'react';
import { withRouter } from 'react-router-dom';

import classes from './Toolbar.module.css';

import Logo from '../../Logo/Logo';
import NavigationItems from '../NavigationItems/NavigationItems';
import DrawerToggle from '../SideDrawer/DrawerToggle/DrawerToggle';

const toolbar = props => (
    <header className={classes.Toolbar}>
        <DrawerToggle clicked={props.drawerToggleClicked}/>
        <h2 className={classes.PhoneOnly}>HanLearn</h2>
        <div className={[classes.Logo, classes.DesktopOnly].join(' ')} onClick={() => props.history.push("/")}>    
            <Logo colour='red'/>
            <h3 className={classes.DesktopOnly}>HanLearn</h3>
        </div>
        <nav className={classes.DesktopOnly}>
            <NavigationItems authenticated={props.isAuth}/>
        </nav>
    </header>
);

export default withRouter(toolbar);