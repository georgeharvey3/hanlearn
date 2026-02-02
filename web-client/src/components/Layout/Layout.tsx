import React, { ReactNode, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Aux from '../../hoc/Aux';

import classes from './Layout.module.css';

import Toolbar from '../Navigation/Toolbar/Toolbar';
import SideDrawer from '../Navigation/SideDrawer/SideDrawer';
import { RootState } from '../../types/store';

interface LayoutState {
  showSideDrawer: boolean;
}

const mapStateToProps = (state: RootState) => {
  return {
    isAuthenticated: state.auth.token !== null,
  };
};

const connector = connect(mapStateToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

interface OwnProps {
  children?: ReactNode;
}

type Props = PropsFromRedux & OwnProps;

const Layout: React.FC<Props> = ({ isAuthenticated, children }) => {
  const [state, setState] = useState<LayoutState>({
    showSideDrawer: false,
  });

  const sideDrawerClosedHandler = (): void => {
    setState({ showSideDrawer: false });
  };

  const sideDrawerToggleHandler = (): void => {
    setState((prevState) => ({ showSideDrawer: !prevState.showSideDrawer }));
  };

  return (
    <Aux>
      <Toolbar drawerToggleClicked={sideDrawerToggleHandler} isAuth={isAuthenticated} />
      <SideDrawer
        open={state.showSideDrawer}
        closed={sideDrawerClosedHandler}
        isAuth={isAuthenticated}
      />
      <main className={classes.Content}>{children}</main>
    </Aux>
  );
};

export default connector(Layout);
