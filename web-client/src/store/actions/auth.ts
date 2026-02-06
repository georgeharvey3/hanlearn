import * as actionTypes from './actionTypes';
import {
  AuthStartAction,
  AuthSuccessAction,
  AuthFailAction,
  AuthLogoutAction,
  AuthInitializedAction,
  RegisterSuccessAction,
  AppThunk,
} from '../../types/actions';
import {
  loginUser,
  registerUser,
  logoutUser,
  subscribeToAuthChanges,
} from '../../firebase/auth';
import { FirebaseError } from 'firebase/app';

export const authStart = (): AuthStartAction => {
  return {
    type: actionTypes.AUTH_START,
  };
};

export const authSuccess = (userId: string): AuthSuccessAction => {
  return {
    type: actionTypes.AUTH_SUCCESS,
    userId: userId,
  };
};

export const registerSuccess = (): RegisterSuccessAction => {
  return {
    type: actionTypes.REGISTER_SUCCESS,
  };
};

export const authFail = (error: string): AuthFailAction => {
  return {
    type: actionTypes.AUTH_FAIL,
    error: error,
  };
};

export const authInitialized = (): AuthInitializedAction => {
  return {
    type: actionTypes.AUTH_INITIALIZED,
  };
};

export const logout = (): AppThunk => {
  return async (dispatch) => {
    try {
      await logoutUser();
      dispatch({
        type: actionTypes.AUTH_LOGOUT,
      } as AuthLogoutAction);
    } catch (error) {
      console.error('Logout error:', error);
      // Still dispatch logout even if Firebase call fails
      dispatch({
        type: actionTypes.AUTH_LOGOUT,
      } as AuthLogoutAction);
    }
  };
};

/**
 * Convert Firebase error codes to user-friendly messages
 */
const getErrorMessage = (error: FirebaseError): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled';
    case 'auth/weak-password':
      return 'Password is too weak';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Invalid password';
    case 'auth/invalid-credential':
      return 'Invalid email or password';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later';
    default:
      return error.message || 'An error occurred';
  }
};

export const auth = (email: string, password: string): AppThunk => {
  return async (dispatch) => {
    dispatch(authStart());
    try {
      const user = await loginUser(email, password);
      dispatch(authSuccess(user.uid));
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        dispatch(authFail(getErrorMessage(error as FirebaseError)));
      } else {
        dispatch(authFail('Login failed'));
      }
    }
  };
};

export const register = (
  email: string,
  username: string,
  password: string
): AppThunk => {
  return async (dispatch) => {
    dispatch(authStart());
    try {
      const user = await registerUser(email, password, username);
      dispatch(authSuccess(user.uid));
      dispatch(registerSuccess());
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        dispatch(authFail(getErrorMessage(error as FirebaseError)));
      } else {
        dispatch(authFail('Registration failed'));
      }
    }
  };
};

/**
 * Initialize auth state listener.
 * This should be called once when the app starts.
 * Firebase will automatically restore the session if the user was previously logged in.
 */
export const initAuthListener = (): AppThunk => {
  return (dispatch) => {
    subscribeToAuthChanges((user) => {
      if (user) {
        dispatch(authSuccess(user.uid));
      } else {
        dispatch(authInitialized());
      }
    });
  };
};

/**
 * @deprecated Use initAuthListener instead.
 * Kept for backwards compatibility during migration.
 */
export const authCheckState = (): AppThunk => {
  return (dispatch) => {
    dispatch(initAuthListener());
  };
};
