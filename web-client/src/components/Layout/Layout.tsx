import React, { ReactNode, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Box from '@mui/material/Box';

import Toolbar from '../Navigation/Toolbar/Toolbar';
import SideDrawer from '../Navigation/SideDrawer/SideDrawer';
import { RootState } from '../../types/store';

interface LayoutState {
  showSideDrawer: boolean;
}

const mapStateToProps = (state: RootState) => {
  return {
    isAuthenticated: state.auth.userId !== null,
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
    <>
      <Toolbar drawerToggleClicked={sideDrawerToggleHandler} isAuth={isAuthenticated} />
      <SideDrawer
        open={state.showSideDrawer}
        closed={sideDrawerClosedHandler}
        isAuth={isAuthenticated}
      />
      <Box component="main" sx={{ mt: '56px', height: '100%' }}>
        {children}
      </Box>
    </>
  );
};

export default connector(Layout);
