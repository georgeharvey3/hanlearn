import * as actionTypes from './actionTypes';
import {
  AuthStartAction,
  AuthSuccessAction,
  AuthFailAction,
  AuthLogoutAction,
  RegisterSuccessAction,
  AppThunk,
} from '../../types/actions';

export const authStart = (): AuthStartAction => {
  return {
    type: actionTypes.AUTH_START,
  };
};

export const authSuccess = (
  userId: string,
  token: string
): AuthSuccessAction => {
  return {
    type: actionTypes.AUTH_SUCCESS,
    token: token,
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

export const logout = (): AuthLogoutAction => {
  localStorage.removeItem('token');
  localStorage.removeItem('expiresAt');
  localStorage.removeItem('userId');
  return {
    type: actionTypes.AUTH_LOGOUT,
  };
};

export const checkAuthTimeOut = (expirationTime: number): AppThunk => {
  return (dispatch) => {
    setTimeout(() => {
      dispatch(logout());
    }, expirationTime);
  };
};

interface LoginResponse {
  token: string;
  expires_at: string;
  user_id: string;
}

interface ErrorResponse {
  message: string;
}

export const auth = (email: string, password: string): AppThunk => {
  return (dispatch) => {
    dispatch(authStart());
    fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    })
      .then((response) => {
        if (response.ok) {
          response.json().then((data: LoginResponse) => {
            localStorage.setItem('token', data.token);
            localStorage.setItem('expiresAt', data.expires_at);
            localStorage.setItem('userId', data.user_id);
            dispatch(authSuccess(data.user_id, data.token));
            dispatch(
              checkAuthTimeOut(
                new Date(data.expires_at).getTime() - new Date().getTime()
              )
            );
          });
        } else {
          response
            .json()
            .then((data: ErrorResponse) => {
              dispatch(authFail(data.message));
            })
            .catch(() => {
              dispatch(authFail(response.statusText));
            });
        }
      })
      .catch((err: Error) => {
        dispatch(authFail(err.message));
      });
  };
};

export const register = (
  email: string,
  username: string,
  password: string
): AppThunk => {
  return (dispatch) => {
    dispatch(authStart());
    fetch('/api/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: email,
        username: username,
        password: password,
      }),
    })
      .then((response) => {
        if (response.ok) {
          dispatch(registerSuccess());
        } else {
          response
            .json()
            .then((data: ErrorResponse) => {
              dispatch(authFail(data.message));
            })
            .catch(() => {
              dispatch(authFail(response.statusText));
            });
        }
      })
      .catch((err: Error) => {
        dispatch(authFail(err.message));
      });
  };
};

export const authCheckState = (): AppThunk => {
  return (dispatch) => {
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch(logout());
    } else {
      const expiresAtStr = localStorage.getItem('expiresAt');
      const expirationDate = expiresAtStr ? new Date(expiresAtStr) : new Date();
      if (expirationDate > new Date()) {
        const userId = localStorage.getItem('userId');
        if (userId) {
          dispatch(authSuccess(userId, token));
          dispatch(
            checkAuthTimeOut(expirationDate.getTime() - new Date().getTime())
          );
        }
      } else {
        dispatch(logout());
      }
    }
  };
};
