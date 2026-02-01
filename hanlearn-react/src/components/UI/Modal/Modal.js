import React from 'react';

import classes from './Modal.module.css';

import Backdrop from '../../UI/Backdrop/Backdrop';
import Aux from '../../../hoc/Aux';

const modal = props => {
    return (
        <Aux>
            <Backdrop 
                show={props.show} 
                clicked={props.modalClosed}/>
            <div 
                className={classes.Modal}
                style={{
                    transform: props.show ? 'translateY(0)' : 'translateY(-100vh)',
                    display: props.show ? 'block': 'none',
                    opactiy: props.show ? '1' : '0'
                }}>
                    <button onClick={props.modalClosed} className={classes.Close}>&times;</button>
                {props.children}
            </div>
        </Aux>
    );
}

export default modal;