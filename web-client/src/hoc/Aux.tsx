import { ReactNode } from 'react';

interface AuxProps {
  children?: ReactNode;
}

const Aux = (props: AuxProps): ReactNode => props.children;

export default Aux;
