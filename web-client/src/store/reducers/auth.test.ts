/**
 * Tests for the auth reducer — covers cases not exercised through action thunk tests.
 */
import { describe, it, expect } from 'vitest';
import reducer from './auth';
import type { AuthState } from '../../types/store';

const initialState: AuthState = {
  userId: null,
  loading: false,
  error: null,
  newSignUp: false,
  initialized: false,
  modalOpen: false,
  modalMode: 'login',
  resetEmailSent: false,
};

describe('auth reducer', () => {
  describe('default / unknown action', () => {
    it('returns initial state when called with undefined state', () => {
      const state = reducer(undefined, { type: '@@INIT' } as any);
      expect(state).toEqual(initialState);
    });

    it('returns existing state for unknown action type', () => {
      const existing: AuthState = { ...initialState, userId: 'u1', initialized: true };
      const state = reducer(existing, { type: 'UNKNOWN' } as any);
      expect(state).toEqual(existing);
    });
  });

  describe('AUTH_START', () => {
    it('sets loading=true, clears error and newSignUp', () => {
      const before: AuthState = { ...initialState, error: 'previous error', newSignUp: true };
      const state = reducer(before, { type: 'AUTH_START' });
      expect(state.loading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.newSignUp).toBe(false);
    });
  });

  describe('AUTH_SUCCESS', () => {
    it('sets userId, clears error and loading, sets initialized=true, closes modal', () => {
      const before: AuthState = { ...initialState, loading: true, modalOpen: true };
      const state = reducer(before, { type: 'AUTH_SUCCESS', userId: 'uid-1' });
      expect(state.userId).toBe('uid-1');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.modalOpen).toBe(false);
    });
  });

  describe('AUTH_FAIL', () => {
    it('sets error message and clears loading', () => {
      const before: AuthState = { ...initialState, loading: true };
      const state = reducer(before, { type: 'AUTH_FAIL', error: 'Invalid password' });
      expect(state.error).toBe('Invalid password');
      expect(state.loading).toBe(false);
    });
  });

  describe('AUTH_LOGOUT', () => {
    it('clears userId, sets initialized=true and newSignUp=false', () => {
      const before: AuthState = {
        ...initialState,
        userId: 'uid-1',
        newSignUp: true,
        initialized: true,
      };
      const state = reducer(before, { type: 'AUTH_LOGOUT' });
      expect(state.userId).toBeNull();
      expect(state.initialized).toBe(true);
      expect(state.newSignUp).toBe(false);
    });
  });

  describe('AUTH_INITIALIZED', () => {
    it('sets initialized=true without changing other state', () => {
      const state = reducer(initialState, { type: 'AUTH_INITIALIZED' });
      expect(state.initialized).toBe(true);
      expect(state.userId).toBeNull();
    });
  });

  describe('REGISTER_SUCCESS', () => {
    it('sets newSignUp=true, clears error and loading', () => {
      const before: AuthState = { ...initialState, loading: true, error: 'some error' };
      const state = reducer(before, { type: 'REGISTER_SUCCESS' });
      expect(state.newSignUp).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('does not change userId or initialized', () => {
      const before: AuthState = { ...initialState, userId: 'uid-1', initialized: true };
      const state = reducer(before, { type: 'REGISTER_SUCCESS' });
      expect(state.userId).toBe('uid-1');
      expect(state.initialized).toBe(true);
    });
  });

  describe('OPEN_AUTH_MODAL', () => {
    it('opens modal in login mode', () => {
      const state = reducer(initialState, { type: 'OPEN_AUTH_MODAL', mode: 'login' });
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('login');
      expect(state.error).toBeNull();
    });

    it('opens modal in register mode', () => {
      const state = reducer(initialState, { type: 'OPEN_AUTH_MODAL', mode: 'register' });
      expect(state.modalOpen).toBe(true);
      expect(state.modalMode).toBe('register');
    });

    it('clears any existing error when opening modal', () => {
      const before: AuthState = { ...initialState, error: 'stale error' };
      const state = reducer(before, { type: 'OPEN_AUTH_MODAL', mode: 'login' });
      expect(state.error).toBeNull();
    });
  });

  describe('CLOSE_AUTH_MODAL', () => {
    it('closes modal and clears error and loading', () => {
      const before: AuthState = {
        ...initialState,
        modalOpen: true,
        error: 'Login failed',
        loading: true,
      };
      const state = reducer(before, { type: 'CLOSE_AUTH_MODAL' });
      expect(state.modalOpen).toBe(false);
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('does not change userId or initialized', () => {
      const before: AuthState = {
        ...initialState,
        userId: 'uid-1',
        initialized: true,
        modalOpen: true,
      };
      const state = reducer(before, { type: 'CLOSE_AUTH_MODAL' });
      expect(state.userId).toBe('uid-1');
      expect(state.initialized).toBe(true);
    });
  });

  describe('SET_AUTH_MODAL_MODE', () => {
    it('changes modal mode to register and clears error', () => {
      const before: AuthState = { ...initialState, modalMode: 'login', error: 'old error' };
      const state = reducer(before, { type: 'SET_AUTH_MODAL_MODE', mode: 'register' });
      expect(state.modalMode).toBe('register');
      expect(state.error).toBeNull();
    });

    it('changes modal mode to login', () => {
      const before: AuthState = { ...initialState, modalMode: 'register' };
      const state = reducer(before, { type: 'SET_AUTH_MODAL_MODE', mode: 'login' });
      expect(state.modalMode).toBe('login');
    });

    it('does not affect modalOpen or userId', () => {
      const before: AuthState = { ...initialState, modalOpen: true, userId: 'uid-1' };
      const state = reducer(before, { type: 'SET_AUTH_MODAL_MODE', mode: 'register' });
      expect(state.modalOpen).toBe(true);
      expect(state.userId).toBe('uid-1');
    });
  });
});
