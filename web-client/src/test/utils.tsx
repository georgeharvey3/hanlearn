import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';

import rootReducer, { PreloadedRootState } from '../store/rootReducer';

export function createTestStore(preloadedState?: PreloadedRootState) {
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
export function authenticatedState(userId = 'test-user-123'): PreloadedRootState {
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
