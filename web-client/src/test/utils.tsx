import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import { thunk } from 'redux-thunk';

import wordsReducer from '../store/reducers/addWords';
import authReducer from '../store/reducers/auth';
import settingsReducer from '../store/reducers/settings';
import notificationsReducer from '../store/reducers/notifications';

export function createTestStore(preloadedState?: Record<string, unknown>) {
  const rootReducer = combineReducers({
    addWords: wordsReducer,
    auth: authReducer,
    settings: settingsReducer,
    notifications: notificationsReducer,
  });
  return createStore(rootReducer, preloadedState, applyMiddleware(thunk));
}

interface WrapperProps {
  store?: ReturnType<typeof createTestStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  { store = createTestStore(), ...renderOptions }: WrapperProps & RenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

/** Authenticated store state — userId set, loading false, initialized true */
export function authenticatedState(userId = 'test-user-123') {
  return {
    auth: {
      userId,
      loading: false,
      error: null,
      newSignUp: false,
      initialized: true,
      modalOpen: false,
      modalMode: 'login' as const,
    },
    addWords: {
      lists: [{ id: 'default', name: 'General', createdAt: '', order: 0 }],
      activeListId: 'default',
      words: [],
      listStats: {},
      error: false,
      loading: false,
    },
    settings: { speechAvailable: false, synthAvailable: false },
  };
}
