import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Redirect } from 'react-router-dom';

import * as actions from '../../../store/actions/index';

const mapDispatchToProps = {
  onLogout: actions.logout,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

const Logout: React.FC<PropsFromRedux> = ({ onLogout }) => {
  useEffect(() => {
    onLogout();
  }, [onLogout]);

  return <Redirect to="/" />;
};

export default connector(Logout);
