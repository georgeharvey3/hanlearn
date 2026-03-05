import React, { ReactNode, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import Container from '@mui/material/Container';

import Toolbar from '../Navigation/Toolbar/Toolbar';
import SideDrawer from '../Navigation/SideDrawer/SideDrawer';
import Sidebar, { SIDEBAR_WIDTH } from '../Navigation/Sidebar/Sidebar';
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
      {isAuthenticated && <Sidebar />}
      <Container
        component="main"
        maxWidth={false}
        sx={{
          mt: '56px',
          pt: 3,
          height: '100%',
          ...(isAuthenticated
            ? {
                ml: { xs: 0, sm: `${SIDEBAR_WIDTH}px` },
                maxWidth: { xs: '100%', sm: 1440 - SIDEBAR_WIDTH },
              }
            : { maxWidth: 1440 }),
        }}
      >
        {children}
      </Container>
    </>
  );
};

export default connector(Layout);
