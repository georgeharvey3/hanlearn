import React, { Component } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { Redirect } from 'react-router-dom';

import * as actions from '../../../store/actions/index';

const mapDispatchToProps = {
  onLogout: actions.logout,
};

const connector = connect(null, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

class Logout extends Component<PropsFromRedux> {
  componentDidMount(): void {
    this.props.onLogout();
  }

  render(): React.ReactNode {
    return <Redirect to="/" />;
  }
}

export default connector(Logout);
