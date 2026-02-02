import * as actionTypes from '../actions/actionTypes';
import { AuthState } from '../../types/store';
import { AuthAction } from '../../types/actions';

const initialState: AuthState = {
  token: null,
  userId: null,
  loading: false,
  error: null,
  newSignUp: false,
};

const reducer = (state = initialState, action: AuthAction): AuthState => {
  switch (action.type) {
    case actionTypes.AUTH_START:
      return {
        ...state,
        loading: true,
        error: null,
      };
    case actionTypes.AUTH_SUCCESS:
      return {
        ...state,
        token: action.token,
        userId: action.userId,
        error: null,
        loading: false,
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
        token: null,
        userId: null,
      };
    case actionTypes.REGISTER_SUCCESS:
      return {
        ...state,
        error: null,
        loading: false,
        newSignUp: true,
      };
    default:
      return state;
  }
};

export default reducer;
