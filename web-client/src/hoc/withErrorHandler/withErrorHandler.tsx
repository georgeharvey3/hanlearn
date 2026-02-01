import React, { ComponentType } from 'react';

import Modal from '../../components/UI/Modal/Modal';
import Aux from '../Aux';

function withErrorHandler<P extends object>(
  WrappedComponent: ComponentType<P>
): React.FC<P> {
  return (props: P) => {
    return (
      <Aux>
        <Modal show={true} modalClosed={() => {}}>
          Something went wrong...
        </Modal>
        <WrappedComponent {...props} />
      </Aux>
    );
  };
}

export default withErrorHandler;
