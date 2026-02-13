import * as actionTypes from '../actions/actionTypes';
import { AuthState } from '../../types/store';
import { AuthAction } from '../../types/actions';

const initialState: AuthState = {
  userId: null,
  loading: false,
  error: null,
  newSignUp: false,
  initialized: false,
  modalOpen: false,
  modalMode: 'login',
};

const reducer = (state = initialState, action: AuthAction): AuthState => {
  switch (action.type) {
    case actionTypes.AUTH_START:
      return {
        ...state,
        loading: true,
        error: null,
        newSignUp: false,
      };
    case actionTypes.AUTH_SUCCESS:
      return {
        ...state,
        userId: action.userId,
        error: null,
        loading: false,
        initialized: true,
        modalOpen: false,
      };
    case actionTypes.AUTH_FAIL:
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    case actionTypes.AUTH_LOGOUT:
      return {
        ...state,
        userId: null,
        initialized: true,
        newSignUp: false,
      };
    case actionTypes.AUTH_INITIALIZED:
      return {
        ...state,
        initialized: true,
      };
    case actionTypes.REGISTER_SUCCESS:
      return {
        ...state,
        error: null,
        loading: false,
        newSignUp: true,
      };
    case actionTypes.OPEN_AUTH_MODAL:
      return {
        ...state,
        modalOpen: true,
        modalMode: action.mode,
        error: null,
      };
    case actionTypes.CLOSE_AUTH_MODAL:
      return {
        ...state,
        modalOpen: false,
        error: null,
        loading: false,
      };
    case actionTypes.SET_AUTH_MODAL_MODE:
      return {
        ...state,
        modalMode: action.mode,
        error: null,
      };
    default:
      return state;
  }
};

export default reducer;
